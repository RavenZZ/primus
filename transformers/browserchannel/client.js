'use strict';
/*globals BCSocket*/

/**
 * Minimum viable BrowserChannel client. This function is stringified and added
 * in our client-side library.
 *
 * @runat client
 * @api private
 */
module.exports = function client() {
  var primus = this
    , socket;

  //
  // Select an available BrowserChannel factory.
  //
  var Factory = (function factory() {
    if ('undefined' !== typeof BCSocket) return BCSocket;

    try { return Primus.require('browserchannel').BCSocket; }
    catch (e) {}

    return undefined;
  })();

  if (!Factory) return primus.critical(new Error(
    'Missing required `browserchannel` module. ' +
    'Please run `npm install --save browserchannel`'
  ));

  //
  // Connect to the given URL.
  //
  primus.on('outgoing::open', function connect() {
    primus.emit('outgoing::end');

    var url = primus.uri({ protocol: 'http' });

    primus.socket = socket = new Factory(url, primus.merge(primus.transport, {
      extraParams: primus.querystring(primus.uri({
        protocol: 'http',
        query: true
      }).replace(url, '')),
      reconnect: false
    }));

    //
    // Setup the Event handlers.
    //
    socket.onopen = primus.trigger('incoming::open');
    socket.onerror = primus.trigger('incoming::error');
    socket.onclose = primus.trigger('incoming::end');
    socket.onmessage = primus.trigger('incoming::data', function parse(next, evt) {
      setTimeout(function defer() {
        next(undefined, evt.data);
      }, 0);
    });
  });

  //
  // We need to write a new message to the socket.
  //
  primus.on('outgoing::data', function write(message) {
    if (socket) socket.send(message);
  });

  //
  // Attempt to reconnect the socket.
  //
  primus.on('outgoing::reconnect', function reconnect() {
    primus.emit('outgoing::open');
  });

  //
  // We need to close the socket.
  //
  primus.on('outgoing::end', function close() {
    if (!socket) return;

    socket.onerror = socket.onopen = socket.onclose = socket.onmessage = function () {};

    //
    // Bug: BrowserChannel cannot close the connection if it's already
    // connecting. Bypass this behaviour by checking the readyState and
    // defer the close call.
    //
    if (socket.readyState === socket.CONNECTING) {
      socket.onopen = function onopen() {
        this.close();
      };
    } else {
      socket.close();
    }
    socket = null;
  });
};
