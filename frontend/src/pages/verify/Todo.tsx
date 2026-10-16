/** Next to a disabled Continue: the first thing still missing, so the applicant knows why it is disabled. */
export function Todo({ text }: { text: string | null }) {
  return text ? <span className="ktodo">To continue, {text}.</span> : null;
}
