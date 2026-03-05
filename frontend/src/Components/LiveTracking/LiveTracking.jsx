"use client";

import { useEffect, useRef, useState } from "react";
import "./livetracking.css";

const LiveTracking = ({
  driverLocation,
  passangerLocation,
  destination,
  driverName,
  vehicleModel,
  driverPhone,
}) => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const markersRef = useRef({});
  const directionsRendererRef = useRef(null);
  const [distance, setDistance] = useState(null);
  const [eta, setEta] = useState(null);

  // Initialize Google Map
  useEffect(() => {
    if (!window.google) {
      console.error("Google Maps not loaded");
      return;
    }

    const mapInstance = new window.google.maps.Map(mapRef.current, {
      zoom: 14,
      center: { lat: 25.2048, lng: 55.2708 }, // Dubai default
      styles: [
        {
          featureType: "water",
          elementType: "geometry",
          stylers: [{ color: "#e9e9e9" }, { lightness: 17 }],
        },
        {
          featureType: "landscape",
          elementType: "geometry",
          stylers: [{ color: "#f3f3f3" }, { lightness: 20 }],
        },
      ],
    });

    setMap(mapInstance);

    return () => {
      // Cleanup markers
      Object.values(markersRef.current).forEach((marker) => {
        if (marker && marker.setMap) {
          marker.setMap(null);
        }
      });
      // Cleanup directions renderer
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
      }
    };
  }, []);

  // Update markers
  useEffect(() => {
    if (!map || !window.google) return;

    // Clear existing markers
    Object.values(markersRef.current).forEach((marker) => {
      if (marker && marker.setMap) {
        marker.setMap(null);
      }
    });

    const newMarkers = {};

    // Driver marker
    if (driverLocation) {
      newMarkers.driver = new window.google.maps.Marker({
        position: driverLocation,
        map,
        title: `Driver: ${driverName}`,
        icon: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
      });

      // Driver info window
      const driverInfoWindow = new window.google.maps.InfoWindow({
        content: `
          <div class="info-window-content">
            <strong>${driverName}</strong><br>
            ${vehicleModel}<br>
            <a href="tel:${driverPhone}">${driverPhone}</a>
          </div>
        `,
      });

      newMarkers.driver.addListener("click", () => {
        Object.values(markersRef.current)
          .filter((m) => m && m.infoWindow)
          .forEach((m) => m.infoWindow.close());
        driverInfoWindow.open(map, newMarkers.driver);
      });
      newMarkers.driver.infoWindow = driverInfoWindow;
    }

    // Passenger marker (pickup location)
    if (passangerLocation) {
      newMarkers.passenger = new window.google.maps.Marker({
        position: passangerLocation,
        map,
        title: "Pickup Location",
        icon: "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
      });
    }

    // Destination marker
    if (destination) {
      newMarkers.destination = new window.google.maps.Marker({
        position: destination,
        map,
        title: "Destination",
        icon: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
      });
    }

    // Fit all markers in view
    if (Object.keys(newMarkers).length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      Object.values(newMarkers).forEach((marker) => {
        bounds.extend(marker.getPosition());
      });
      map.fitBounds(bounds);
    }

    // Update ref instead of state
    markersRef.current = newMarkers;
  }, [
    map,
    driverLocation,
    passangerLocation,
    destination,
    driverName,
    vehicleModel,
    driverPhone,
  ]);

  // Draw route
  useEffect(() => {
    if (!map || !driverLocation || !destination || !window.google) return;

    const directionsService = new window.google.maps.DirectionsService();

    // Clean up previous renderer
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null);
    }

    const directionsRenderer = new window.google.maps.DirectionsRenderer({
      map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: "#3b82f6",
        strokeWeight: 4,
      },
    });

    directionsRendererRef.current = directionsRenderer;

    directionsService.route(
      {
        origin: driverLocation,
        destination: destination,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          directionsRenderer.setDirections(result);
          const route = result.routes[0];
          if (route && route.legs[0]) {
            setDistance(route.legs[0].distance.text);
            setEta(route.legs[0].duration.text);
          }
        } else {
          console.error("Directions request failed:", status);
        }
      },
    );

    return () => {
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
      }
    };
  }, [map, driverLocation, destination]);

  return (
    <div className="live-tracking-container">
      <div className="tracking-info">
        <div className="info-row">
          <span className="label">Distance:</span>
          <span className="value">{distance || "Calculating..."}</span>
        </div>
        <div className="info-row">
          <span className="label">ETA:</span>
          <span className="value">{eta || "Calculating..."}</span>
        </div>
        <div className="info-row">
          <span className="label">Driver:</span>
          <span className="value">{driverName}</span>
        </div>
        <div className="info-row">
          <span className="label">Vehicle:</span>
          <span className="value">{vehicleModel}</span>
        </div>
      </div>
      <div className="map-container" ref={mapRef}></div>
    </div>
  );
};

export default LiveTracking;
