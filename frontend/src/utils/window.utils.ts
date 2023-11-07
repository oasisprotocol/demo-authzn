export abstract class WindowUtils {
  static postMessageToOpener = <T = any>(message: T) => {
    if (window.opener) {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.includes('?') ?
        window.location.hash.split('?')[1]
        :
        window.location.hash
      )
      origin = params.get('origin') ?? hashParams.get('origin');

      // TODO: Unsafe
      window.opener.postMessage(message, origin);

      window.close();
    }
  }
}
