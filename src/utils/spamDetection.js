/**
 * Spam Detection Utility
 * Detects and filters robocalls, sales calls, and irrelevant calls
 *
 * Per scope requirements (§3.5):
 * - Filter robocalls, sales calls, and irrelevant calls
 * - Flag suspicious calls in logs for staff review
 * - Document exact rules for terminating/flagging spam
 */

const logger = require('../config/logger');

// Spam detection thresholds (configurable via env)
const SILENCE_THRESHOLD_MS = parseInt(process.env.SPAM_SILENCE_THRESHOLD_MS) || 3000;
const KEYWORD_MATCH_THRESHOLD = parseInt(process.env.SPAM_KEYWORD_MATCH_THRESHOLD) || 2;

/**
 * Keywords commonly used in spam/robocalls
 */
const SPAM_KEYWORDS = [
  // Sales/Marketing
  'special offer',
  'limited time',
  'act now',
  'free gift',
  'congratulations you\'ve won',
  'you have been selected',
  'press 1',
  'press one',
  'warranty',
  'car warranty',
  'extended warranty',
  'insurance rates',
  'lower your rate',
  'refinance',
  'credit card',
  'debt relief',
  'student loan',
  'solar panel',
  'free vacation',
  'timeshare',

  // Political/Survey
  'political survey',
  'quick survey',
  'your opinion',
  'brief survey',

  // Scams
  'irs',
  'social security',
  'arrest warrant',
  'police will',
  'legal action',
  'verify your identity',
  'account suspended',
  'suspicious activity',
  'computer virus',
  'tech support',
  'microsoft calling',
  'apple support',

  // Robocall indicators
  'automated message',
  'this is a recording',
  'this call is being recorded for',
  'do not hang up',
  'important message about',
  'regarding your account'
];

/**
 * Patterns that indicate robocall behavior
 */
const ROBOCALL_PATTERNS = [
  /press \d/i,
  /press (one|two|three|four|five|six|seven|eight|nine|zero)/i,
  /this is (a|an) (automated|recorded|important)/i,
  /you('ve| have) been (selected|chosen|approved)/i,
  /final (notice|warning|attempt)/i,
  /act (now|immediately|today)/i,
  /(don't|do not) hang up/i,
  /call (back|us back) (at|immediately)/i
];

/**
 * Phone number patterns associated with spam
 */
const SPAM_NUMBER_PATTERNS = [
  /^\+1800/, // Toll-free often used for robocalls
  /^\+1888/,
  /^\+1877/,
  /^\+1866/,
  /^\+1855/,
  /^\+1844/,
  /^\+1833/,
  // International prefixes that shouldn't be calling urgent care
  /^\+44/, // UK
  /^\+91/, // India
  /^\+234/, // Nigeria
  /^\+86/ // China
];

/**
 * Analyze a call for spam indicators
 * @param {Object} callData - Call data including transcript
 * @returns {Object} Spam analysis result
 */
function analyzeCall(callData) {
  const reasons = [];
  let spamScore = 0;

  const transcript = (callData.transcript || '').toLowerCase();
  const callerNumber = callData.metadata?.callerNumber || callData.caller_number || '';
  const duration = callData.duration || 0;

  // Check 1: Silence at start (robocall warm-up)
  if (callData.metadata?.silenceAtStart > SILENCE_THRESHOLD_MS) {
    spamScore += 2;
    reasons.push('Extended silence at call start');
  }

  // Check 2: Very short duration with no meaningful interaction
  if (duration < 5 && transcript.length < 20) {
    spamScore += 1;
    reasons.push('Very short call with minimal interaction');
  }

  // Check 3: Spam keywords in transcript
  const keywordMatches = SPAM_KEYWORDS.filter(keyword =>
    transcript.includes(keyword.toLowerCase())
  );

  if (keywordMatches.length >= KEYWORD_MATCH_THRESHOLD) {
    spamScore += keywordMatches.length;
    reasons.push(`Spam keywords detected: ${keywordMatches.join(', ')}`);
  }

  // Check 4: Robocall patterns
  const patternMatches = ROBOCALL_PATTERNS.filter(pattern =>
    pattern.test(transcript)
  );

  if (patternMatches.length > 0) {
    spamScore += patternMatches.length * 2;
    reasons.push('Robocall speech patterns detected');
  }

  // Check 5: Suspicious phone number
  const isSpamNumber = SPAM_NUMBER_PATTERNS.some(pattern =>
    pattern.test(callerNumber)
  );

  if (isSpamNumber) {
    spamScore += 1;
    reasons.push('Caller number matches spam pattern');
  }

  // Check 6: No healthcare-related content
  const healthcareTerms = [
    'sick', 'hurt', 'pain', 'appointment', 'doctor', 'nurse',
    'clinic', 'visit', 'patient', 'medical', 'health', 'symptoms',
    'injury', 'fever', 'cough', 'emergency', 'urgent', 'care'
  ];

  const hasHealthcareContent = healthcareTerms.some(term =>
    transcript.includes(term)
  );

  if (transcript.length > 50 && !hasHealthcareContent) {
    spamScore += 1;
    reasons.push('No healthcare-related content in conversation');
  }

  // Determine if spam (threshold: 3)
  const isSpam = spamScore >= 3;

  if (isSpam) {
    logger.warn('Spam call detected', {
      callId: callData.callId,
      spamScore,
      reasons
    });
  }

  return {
    isSpam,
    spamScore,
    reasons,
    confidence: Math.min(spamScore / 5, 1), // 0-1 confidence score
    recommendation: isSpam ? 'FLAG_AND_TERMINATE' : 'PROCEED'
  };
}

/**
 * Quick check if a phone number is likely spam
 * Can be used before answering to pre-filter
 * @param {string} phoneNumber - Caller's phone number
 * @returns {Object} Quick spam check result
 */
function quickNumberCheck(phoneNumber) {
  const isSpamNumber = SPAM_NUMBER_PATTERNS.some(pattern =>
    pattern.test(phoneNumber)
  );

  return {
    isSuspicious: isSpamNumber,
    reason: isSpamNumber ? 'Phone number matches known spam pattern' : null
  };
}

/**
 * Check if transcript suggests call should be terminated
 * For real-time monitoring during calls
 * @param {string} transcript - Current transcript
 * @returns {boolean} Whether to terminate
 */
function shouldTerminate(transcript) {
  const lowerTranscript = transcript.toLowerCase();

  // Immediate termination triggers
  const immediateTerminators = [
    'this is a recorded message',
    'this is an automated call',
    'press 1 to',
    'press one to',
    'your car warranty',
    'extended warranty',
    'you\'ve been selected',
    'you have won'
  ];

  return immediateTerminators.some(trigger =>
    lowerTranscript.includes(trigger)
  );
}

/**
 * Get spam detection rules for documentation
 * Per scope requirement to document exact rules
 * @returns {Object} Documentation of spam rules
 */
function getSpamRules() {
  return {
    description: 'Spam detection rules for the AI Receptionist',
    thresholds: {
      silenceThresholdMs: SILENCE_THRESHOLD_MS,
      keywordMatchThreshold: KEYWORD_MATCH_THRESHOLD,
      spamScoreThreshold: 3
    },
    terminationTriggers: [
      'Recorded message announcements',
      'Automated call declarations',
      'Press 1/one prompts',
      'Car/extended warranty mentions',
      'Prize/selection announcements'
    ],
    flaggingCriteria: [
      'Extended silence at call start (>3 seconds)',
      'Multiple spam keywords detected (2+)',
      'Robocall speech patterns',
      'Suspicious phone number origin',
      'No healthcare content in longer conversations'
    ],
    suspiciousNumberPrefixes: [
      '1-800, 1-888, 1-877, 1-866, 1-855, 1-844, 1-833 (toll-free)',
      'International: +44 (UK), +91 (India), +234 (Nigeria), +86 (China)'
    ]
  };
}

module.exports = {
  analyzeCall,
  quickNumberCheck,
  shouldTerminate,
  getSpamRules,
  SPAM_KEYWORDS,
  ROBOCALL_PATTERNS
};
