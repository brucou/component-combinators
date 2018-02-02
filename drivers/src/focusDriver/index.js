import {assertContract} from '../../../contracts/src/index'

export function focusDriver(sink$) {
  sink$.map(function focusDriver(sinkValue) {
    assertContract(isFocusDriverInput, [sinkValue], `focusDriver > fails contract!`);

    return sinkValue
    ? document.querySelector(sinkValue.selector).focus()
      : null
  })
    .subscribe(
      function(){},
      function (err){console.error(`focusDriver > Error!`, err)},
      function (){}
      );
}

function isFocusDriverInput (sinkValue){
  return sinkValue && sinkValue.selector && true
}
