// Email validation utilities
// Blocks disposable/temporary email providers

/**
 * List of disposable email domains to block
 * Source: DISPOSABLE_EMAIL_BLOCKLIST.md
 */
const DISPOSABLE_EMAIL_DOMAINS = [
  'mailinator.com',
  'guerrillamail.com',
  'tempmail.com',
  'throwaway.email',
  'yopmail.com',
  'sharklasers.com',
  'guerrillamailblock.com',
  'grr.la',
  'guerrillamail.info',
  'guerrillamail.biz',
  'guerrillamail.de',
  'guerrillamail.net',
  'guerrillamail.org',
  'spam4.me',
  'trashmail.com',
  'trashmail.me',
  'trashmail.net',
  'trashmail.at',
  'trashmail.io',
  'trashmail.xyz',
  'fakeinbox.com',
  'mailnull.com',
  'maildrop.cc',
  'dispostable.com',
  'disposablemail.com',
  'disposableinbox.com',
  'getairmail.com',
  'mailtemp.net',
  'tempinbox.com',
  'tempemail.com',
  'temp-mail.org',
  'temp-mail.io',
  'tmpmail.net',
  'tmpmail.org',
  'tmailinator.com',
  'throwam.com',
  'throwam.org',
  'spamgourmet.com',
  'spamgourmet.net',
  'spamgourmet.org',
  'spamhereplease.com',
  'spamoff.de',
  'spam.la',
  'binkmail.com',
  'bobmail.info',
  'clroid.com',
  'dayrep.com',
  'discard.email',
  'discardmail.com',
  'dodgit.com',
  'dump-email.info',
  'emailondeck.com',
  'fakemailz.com',
  'filzmail.com',
  'fleckens.hu',
  'getonemail.com',
  'haltospam.com',
  'hatespam.org',
  'ihateyoualot.info',
  'iheartspam.org',
  'inoutmail.de',
  'inoutmail.eu',
  'inoutmail.info',
  'inoutmail.net',
  'jetable.com',
  'jetable.fr.nf',
  'jetable.net',
  'jetable.org',
  'junk1.com',
  'kasmail.com',
  'kaspop.com',
  'killmail.com',
  'killmail.net',
  'klzlk.com',
  'kurzepost.de',
  'letthemeatspam.com',
  'lol.ovpn.to',
  'lookugly.com',
  'lortemail.dk',
  'meltmail.com',
  'momentics.ru',
  'moncourrier.fr.nf',
  'monemail.fr.nf',
  'monmail.fr.nf',
  'mt2009.com',
  'mt2014.com',
  'neverbox.com',
  'no-spam.ws',
  'nobulk.com',
  'noclickemail.com',
  'nomail.pw',
  'nomail.xl.cx',
  'nospamfor.us',
  'nospamthanks.info',
  'notmailinator.com',
  'nowmymail.com',
  'objectmail.com',
  'obobbo.com',
  'onewaymail.com',
  'ordinaryamerican.net',
  'owlpic.com',
  'pookmail.com',
  'proxymail.eu',
  'putthisinyourspamdatabase.com',
  'quickinbox.com',
  'rcpt.at',
  'regbypass.com',
  'rejectmail.com',
  'rklips.com',
  'rmqkr.net',
  'rppkn.com',
  'rtrtr.com',
  's0ny.net',
  'safe-mail.net',
  'safetymail.info',
  'safetypost.de',
  'sendspamhere.com',
  'sharedmailbox.org',
  'skeefmail.com',
  'slopsbox.com',
  'smellfear.com',
  'snkmail.com',
  'sogetthis.com',
  'soodomail.com',
  'soodonims.com',
  'spamaway.com',
  'spamavert.com',
  'spambox.info',
  'spambox.us',
  'spamcannon.com',
  'spamcannon.net',
  'spamcero.com',
  'spamcon.org',
  'spamcorptastic.com',
  'spamcowboy.com',
  'spamcowboy.net',
  'spamcowboy.org',
  '10minutemail.com',
  'minutemail.com',
  'emailtemporanea.com',
  'emailtemporanea.net',
  'emailtemporario.com.br',
];

/**
 * Validates if an email address is from a disposable email provider
 * @param email - Email address to validate
 * @returns Object with isValid boolean and error message if invalid
 */
export function validateEmail(email: string): { isValid: boolean; error?: string } {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Email is required' };
  }

  const trimmedEmail = email.trim().toLowerCase();
  
  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  // Extract domain from email
  const domain = trimmedEmail.split('@')[1];
  
  // Check if domain is in disposable email list
  if (DISPOSABLE_EMAIL_DOMAINS.includes(domain)) {
    return { 
      isValid: false, 
      error: 'Email provider not supported. Please use a permanent email address.' 
    };
  }

  return { isValid: true };
}

/**
 * Checks if an email domain is disposable
 * @param email - Email address to check
 * @returns true if email is from a disposable provider
 */
export function isDisposableEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const domain = email.trim().toLowerCase().split('@')[1];
  return DISPOSABLE_EMAIL_DOMAINS.includes(domain);
}
