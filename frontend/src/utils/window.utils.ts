export abstract class WindowUtils {
  static getSearchParam = (param: string) => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.includes('?') ?
      window.location.hash.split('?')[1]
      :
      window.location.hash
    )
    return params.get(param) ?? hashParams.get(param);
  }

  static postMessageToOpener = <T = any>(message: T) => {
    if (window.opener) {
      const origin = WindowUtils.getSearchParam('origin');

      // TODO: Unsafe
      window.opener.postMessage({target: 'authzn-popup', ...message}, origin);

      window.close();
    }
  }
}
