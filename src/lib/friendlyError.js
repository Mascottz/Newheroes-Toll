// ============================================================================
// friendlyError — turns technical errors (network failures, database codes,
// server messages) into short, plain-English sentences safe to show to any
// user. The original message is logged to the console so nothing is lost
// for debugging.
// ============================================================================

const GENERIC_FALLBACK = 'Something went wrong. Please try again.';

export default function friendlyError(err, fallback = GENERIC_FALLBACK) {
  const raw = String(
    (err && (err.message || err.error_description || err.error)) || (typeof err === 'string' ? err : '') || ''
  );

  // Nothing useful to show — use the fallback
  if (!raw.trim()) return fallback;

  // No internet / server unreachable
  if (
    /failed to fetch|fetch failed|networkerror|network error|load failed|net::|offline|timed? ?out|aborted|connection (reset|refused|closed)/i.test(
      raw
    )
  ) {
    return "We couldn't reach the internet. Please check your connection and try again.";
  }

  // Part of the online service not set up yet (missing tables / server steps)
  if (/PGRST20|schema cache|does not exist|Searched for the function|relation "/i.test(raw)) {
    return 'This part of the app is not set up on the online service yet. Please ask your manager or technical support to complete the setup.';
  }

  // Sign-in problems
  if (/invalid login credentials/i.test(raw)) return 'Incorrect email or password.';
  if (/email not confirmed/i.test(raw)) {
    return 'This email has not been confirmed yet. Please check the inbox for a confirmation message.';
  }
  if (/already (registered|exists)/i.test(raw)) return 'An account with this email already exists.';
  if (/rate limit|too many requests/i.test(raw)) {
    return 'Too many attempts. Please wait a moment and try again.';
  }

  // Duplicate record
  if (/duplicate key|unique constraint/i.test(raw)) return 'This record already exists.';

  // Permission problems
  if (
    /row-level security|permission denied|violates|unauthorized|forbidden|\b40[13]\b|jwt|token|access denied/i.test(
      raw
    )
  ) {
    return "You don't have permission to do this. If you think this is a mistake, please ask your manager for help.";
  }

  // Already-plain messages pass through — but nothing that looks technical
  const looksTechnical =
    raw.length > 140 ||
    /PGRST|\{|\}|=>|undefined|null\b|function|schema|rpc|supabase|postgres|payload|stack|cannot read|read properties/i.test(
      raw
    );
  const message = looksTechnical ? fallback : raw;

  if (message !== raw) console.warn('[plain-message] original error was:', raw || '(empty)');
  return message;
}
