window.onload = function() {
  // Get a reference to the <div> on the page that will display the
  // message text.
  var messageEle = document.getElementById('devtool_app');

  // A function to process messages received by the window.
  function receiveMessage(e) {
    // Update the div element to display the message.
    messageEle.innerHTML = "Message Received: " + e.data;
  }

  // Setup an event listener that calls receiveMessage() when the window
  // receives a new MessageEvent.
  window.addEventListener('message', receiveMessage);
}
