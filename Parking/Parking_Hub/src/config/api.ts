// This file handles API configuration and automatically chooses the correct base URL
// depending on the platform the app is running on (Android emulator, iOS simulator, or
// physical device).  This removes the need to manually update the development machine's
// IP address each time the network changes.

import { Platform } from 'react-native';

// Port that your Express backend listens on (matches web server/index.mjs -> 3001)
const DEV_API_PORT = 3001;

// Utility function to build a base URL with the supplied host/IP
const makeUrl = (host: string) => `http://${host}:${DEV_API_PORT}`;

// When running on an Android emulator, the host machine can be reached via 10.0.2.2
// For iOS simulator, we can safely use localhost
// For a physical device (Android or iOS) connected to the same Wi-Fi network, we fall
// back to the local network IP address of the host machine which can be provided via
// the DEV_API_HOST environment variable at runtime.  If that variable is not set we
// default to localhost so that the code still works on simulators.

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const devHost: string =
  // @ts-ignore – Expo injects this variable when using "expo start --dev-client" or in the browser debugger
  (process.env.DEV_API_HOST as string) || 'localhost';

let BASE_URL: string;

if (__DEV__) {
  if (Platform.OS === 'android') {
    // Android emulator has a special DNS entry to access the host machine
    BASE_URL = makeUrl('10.0.2.2');
  } else {
    // iOS simulator or physical device (if same network IP is supplied)
    BASE_URL = makeUrl(devHost);
  }
} else {
  // Production URL – replace with your production backend URL
  BASE_URL = 'https://your-production-api.com';
}

// API endpoints
const API = {
  base: BASE_URL,
  login: `${BASE_URL}/api/login`,
  register: `${BASE_URL}/api/register`,
  parkingSpots: `${BASE_URL}/api/parking-spots`,
  bookings: `${BASE_URL}/api/bookings`,
  paymongoCheckout: `${BASE_URL}/api/paymongo/checkout`,
};

// Named exports for convenience
export const API_BASE_URL = BASE_URL;
export const PAYMONGO_CHECKOUT = API.paymongoCheckout;

export default API;