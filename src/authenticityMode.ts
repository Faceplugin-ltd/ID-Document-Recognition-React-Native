/** `response.Authenticity`: none | normal. */
export type AuthenticityMode = 'none' | 'normal';

export type AuthenticityArg = boolean | AuthenticityMode | string;

export function authenticityModeValue(
  authenticity: AuthenticityArg = true
): AuthenticityMode {
  if (authenticity === false || authenticity === 'none') return 'none';
  return 'normal';
}
