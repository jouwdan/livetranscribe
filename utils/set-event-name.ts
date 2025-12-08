/**
 * Utility function to set the event name in the document title
 */
export function setEventName(name: string) {
  if (typeof document !== "undefined") {
    document.title = `${name} - LiveTranscribe`
  }
}
