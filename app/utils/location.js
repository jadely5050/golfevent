/**
 * Fetches the current GPS coordinates using the browser's Geolocation API.
 * @returns {Promise<{lat: number, lng: number, accuracy: number}>}
 */
export const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('이 브라우저에서는 위치 정보를 지원하지 않습니다.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        });
      },
      (error) => {
        let message = '위치 정보를 가져오는 데 실패했습니다.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = '위치 정보 접근 권한이 거부되었습니다.';
            break;
          case error.POSITION_UNAVAILABLE:
            message = '위치 정보를 사용할 수 없습니다.';
            break;
          case error.TIMEOUT:
            message = '위치 정보 요청 시간이 초과되었습니다.';
            break;
        }
        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
};
