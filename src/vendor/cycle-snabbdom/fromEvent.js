import * as Rx from 'rx'
const Observable = Rx.Observable;

export function fromEvent (eventType, node, useCapture) {
  return Observable.create((observer) => {
    const listener = ev => observer.next(ev)

    node.addEventListener(eventType, listener, useCapture)

    return () => node.removeEventListener(eventType, listener, useCapture)
  })
}
