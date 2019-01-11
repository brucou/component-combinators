import * as Rx from "rx"
import { merge } from "ramda"

const $ = Rx.Observable;

/**
 * Two-way cross-domain emission driver, based on post-robot
 * sink : the data to send
 * source : returned/error value from the receiver
 * @param {*} postRobot
 * @param {String} channel
 * @param {Window} window
 * @param {*} options
 * @returns {function(*): *}
 */
export function makePostRobotEmitterDriver(postRobot, channel, window, options) {
  return function (sink$) {
    return sink$
      .flatMap(data => $.fromPromise(postRobot.send(window, channel, data, options))
        .catch(e => $.just({ error: e }))
      )
      .share()
  }
}

/**
 * One-way cross-domain driver for listening on incoming messages, based on `post-robot`
 * source : the messages from the given `channel`, on the given `window`
 * sink : listener function which can possibly return a value to the sender
 * Typically, API users should only use one of the two : pass a meaningful function, access incoming messages
 * through the source. This is so because using both can lead to concurrency issues (incoming message is passed on
 * source the soonest on the next tick after being received).
 * @param postRobot
 * @param {String} channel
 * @param {Window} window
 * @param {{domain:string, window:Window, timeout:Number}} options
 * @returns {function(*): *}
 */
export function makePostRobotListenerDriver(postRobot, channel, window, options) {
  // One-way driver, receives messages from the iframe
  const subject = new Rx.Subject();
  let disposeFn = null;
  opts = { window };

  return function (sink$) {
    sink$.do(fn => {
      if (disposeFn) disposeFn();
      disposeFn = postRobot.on(channel, merge(window, options), event => {
        setTimeout(() => subject.onNext(event), 0);
        return fn(event)
      });
    })
      .subscribe(x => null, err => null, _ => null)

    return subject
  }
}
