export function WithEvents(withEventsSettings, componentTree){
  // TODO : put a specific trace to mark actions for future tracer
  return m({}, withEventsSettings, componentTree)
}
