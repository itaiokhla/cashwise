import { useEffect, useState } from "react";

export default function useLocation() {
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleGetLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(showPosition, showError, {
          enableHighAccuracy: true,
        });
      } else {
        setError("Geolocation is not supported by this browser.");
      }
    };

    const showPosition = (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      setCurrentLocation({ latitude, longitude });
      setError(null); // Clear any previous errors
    };

    const showError = (error: GeolocationPositionError) => {
      switch (error.code) {
        case error.PERMISSION_DENIED:
          setError("User  denied the request for Geolocation.");
          break;
        case error.POSITION_UNAVAILABLE:
          setError("Location information is unavailable.");
          break;
        case error.TIMEOUT:
          setError("The request to get user location timed out.");
          break;
        default:
          setError("Unhandled geolocation error.");
          break;
      }
    };

    // Call the function to get the location
    handleGetLocation();

    // Optionally, you can return a cleanup function if you want to stop watching the location
    return () => {
      // Cleanup logic if needed
    };
  }, []);

  return { currentLocation, error };
}
