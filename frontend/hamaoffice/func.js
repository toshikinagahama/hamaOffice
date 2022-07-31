export const getDeviceStream = (option) => {
  if ('getUserMedia' in navigator.mediaDevices) {
    console.log('navigator.mediaDevices.getUserMadia');
    return navigator.mediaDevices.getUserMedia(option);
  } else {
    console.log('wrap navigator.getUserMadia with Promise');
    return new Promise(function (resolve, reject) {
      navigator.getUserMedia(option, resolve, reject);
    });
  }
};
