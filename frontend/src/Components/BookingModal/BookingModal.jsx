/* eslint-disable no-unused-vars */
"use client";

import { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  createB2CBooking,
  createCorporateBooking,
  clearBookingData,
} from "../../Redux/slices/bookingSlice";
import api from "../../utils/api";
import {
  FaTimes,
  FaMapMarkerAlt,
  FaUser,
  FaBus,
  FaCalendarAlt,
  FaMinus,
  FaPlus,
  FaCreditCard,
  FaMoneyBillWave,
  FaUniversity,
  FaCheck,
  FaSpinner,
} from "react-icons/fa";
import "./bookingmodal.css";

const BookingModal = ({ route, isOpen, onClose, isCorporate, onSuccess }) => {
  const dispatch = useDispatch();
  const { loading, error, currentBooking, bookingCreated, paymentData } =
    useSelector((state) => state.booking);
  const { user } = useSelector((state) => state.auth);
  
  // State for schedule data
  const [scheduleData, setScheduleData] = useState(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  const [numberOfSeats, setNumberOfSeats] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [selectedReturnTrip, setSelectedReturnTrip] = useState(null);
  const [selectedPassType, setSelectedPassType] = useState("ONE_WAY");
  const [tripSeatAvailability, setTripSeatAvailability] = useState({}); // Store seat availability per trip
  const [selectedPickupPoint, setSelectedPickupPoint] = useState("");
  const [selectedDropoffPoint, setSelectedDropoffPoint] = useState("");
  const [selectedReturnPickupPoint, setSelectedReturnPickupPoint] = useState("");
  const [selectedReturnDropoffPoint, setSelectedReturnDropoffPoint] = useState("");
  const [passDuration, setPassDuration] = useState(1); // months
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedDays, setSelectedDays] = useState([]); // Selected travel days (Mon-Sun)
  

  // Set default pickup/dropoff points and selected days when route changes
  useEffect(() => {
    if (route) {
      setSelectedPickupPoint(route.fromLocation || "");
      setSelectedDropoffPoint(route.toLocation || "");
      setSelectedReturnPickupPoint(route.toLocation || "");
      setSelectedReturnDropoffPoint(route.fromLocation || "");
      
      // Initialize selected days from route's available days
      const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const routeDays = route.availableDays || route.schedule?.availableDays || [];
      
      if (Array.isArray(routeDays) && routeDays.length > 0) {
        setSelectedDays(routeDays.map(d => d.charAt(0).toUpperCase() + d.slice(1).toLowerCase()));
      } else if (typeof routeDays === 'string') {
        if (routeDays.toLowerCase() === 'daily' || routeDays.toLowerCase() === 'all') {
          setSelectedDays(allDays);
        } else if (routeDays.toLowerCase() === 'weekdays') {
          setSelectedDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
        } else if (routeDays.toLowerCase() === 'weekends') {
          setSelectedDays(['Saturday', 'Sunday']);
        } else {
          setSelectedDays(allDays);
        }
      } else {
        setSelectedDays(allDays);
      }
    }
  }, [route]);

  useEffect(() => {
    const fetchScheduleData = async () => {
      if (!route || !route._id) return;
      
      setLoadingSchedule(true);
      try {
        const response = await api.get(`/b2c-partner/routes/${route._id}/schedules`);
        const data = response.data;
        
        if (data.success && data.schedules && data.schedules.length > 0) {
          const activeSchedule = data.schedules.find(s => s.isActive) || data.schedules[0];
          setScheduleData(activeSchedule);
        } else {
          setScheduleData(null);
        }
      } catch (error) {
        console.error("Error fetching schedule:", error);
        setScheduleData(null);
      } finally {
        setLoadingSchedule(false);
      }
    };

    fetchScheduleData();
  }, [route, user?.token]);

  // Fetch real-time seat availability for trips
  const fetchTripSeatAvailability = async () => {
    const routeIdentifier = route?._id || route?.routeId;
    if (!routeIdentifier) return;

    try {
      const response = await api.get(`/b2c-partner/public/routes/${routeIdentifier}/trips/seat-availability`);
      const data = response.data;
      setTripSeatAvailability(data.seatAvailability || {});
    } catch (error) {
      console.error("Error fetching seat availability:", error);
    }
  };

  // Fetch seat availability when schedule data loads
  useEffect(() => {
    if (scheduleData) {
      fetchTripSeatAvailability();
    }
  }, [scheduleData, route?._id, route?.routeId, user?.token]);

  // Also fetch seat availability when route changes (immediate trigger)
  useEffect(() => {
    const routeIdentifier = route?._id || route?.routeId;
    if (routeIdentifier) {
      fetchTripSeatAvailability();
    }
  }, [route]);

  // Retry fetch if seat data not available on initial load
  useEffect(() => {
    const routeIdentifier = route?._id || route?.routeId;
    if (routeIdentifier && !Object.keys(tripSeatAvailability).length) {
      fetchTripSeatAvailability();
    }
  }, [route, tripSeatAvailability]);

  const paymentMethodRef = useRef(paymentMethod);
  const onSuccessRef = useRef(onSuccess);
  const isCorporateRef = useRef(isCorporate);

  useEffect(() => {
    paymentMethodRef.current = paymentMethod;
  }, [paymentMethod]);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    isCorporateRef.current = isCorporate;
  }, [isCorporate]);

  // Effect 1: Handle payment URL redirects
  useEffect(() => {
    if (bookingCreated && paymentData?.paymentUrl) {
      window.location.href = paymentData.paymentUrl;
    }
  }, [bookingCreated, paymentData]);

  // Effect 2: Handle step transition for CASH and CORPORATE bookings
  useEffect(() => {
    if (
      bookingCreated &&
      (paymentMethodRef.current === "CASH" || isCorporateRef.current)
    ) {
      // Defer the state update to avoid cascading renders
      queueMicrotask(() => {
        setStep(3);
        const timer = setTimeout(() => {
          if (onSuccessRef.current) onSuccessRef.current();
        }, 2000);
        return () => clearTimeout(timer);
      });
    }
  }, [bookingCreated]);

  useEffect(() => {
    return () => {
      dispatch(clearBookingData());
    };
  }, [dispatch]);

  if (!isOpen || !route) return null;

  // MONTHLY PASS PRICING LOGIC - Per-day pricing
  // oneWayPrice and roundTripPrice are PER DAY rates from route document
  const getPerDayPrice = () => {
    if (selectedPassType === "ONE_WAY") {
      return route.pricing?.oneWayPrice || route.oneWayPrice || 100;
    } else {
      return route.pricing?.roundTripPrice || route.roundTripPrice || 200;
    }
  };

  // Calculate travel days per month based on user's selected days
  const getTravelDaysPerMonth = () => {
    if (selectedDays.length === 0) return 0;
    if (selectedDays.length === 7) return 30; // Full week ~ 30 days
    // Approximate: (selected days per week / 7) * 30 days in month
    return Math.round((selectedDays.length / 7) * 30);
  };

  // Toggle a day in selectedDays
  const toggleDay = (day) => {
    const routeDays = route.availableDays || route.schedule?.availableDays || [];
    const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    // Get the available days for this route
    let allowedDays = allDays;
    if (Array.isArray(routeDays) && routeDays.length > 0) {
      allowedDays = routeDays.map(d => d.charAt(0).toUpperCase() + d.slice(1).toLowerCase());
    }
    // Only allow toggling days that the route operates on
    if (!allowedDays.includes(day)) return;
    
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day) 
        : [...prev, day]
    );
  };

  const availableSeats = route.availableSeats ?? route.totalSeats ?? 10;
  const currency = route.pricing?.currency || route.currency || "KWD";
  const currencyDecimals = currency === "KWD" || currency === "BHD" || currency === "OMR" ? 3 : 2;
  const perDayPrice = getPerDayPrice();
  const travelDaysPerMonth = getTravelDaysPerMonth();
  const pricePerMonth = perDayPrice * travelDaysPerMonth;
  const totalAmount = (pricePerMonth * numberOfSeats * passDuration).toFixed(currencyDecimals);
  const adminCommission = (totalAmount * 0.2).toFixed(currencyDecimals);
  const driverEarnings = (totalAmount * 0.8).toFixed(currencyDecimals);

  // Get available trips from schedule data
  const availableTrips = route.upcomingTrips || [];
  const tripTimes = scheduleData?.tripTimes || route.tripTimes || [];

  // Create trip options from schedule data
  // For ONE_WAY: Show all One Way trips
  // For ROUND_TRIP: Show 2 separate trips - outbound and return
  
  const allTrips = [];
  
  tripTimes.forEach(trip => {
    if (trip.tripType === "One Way") {
      // Add one way trip as is - always outbound for One Way trips
      allTrips.push({
        ...trip,
        direction: 'outbound', // One Way trips are always outbound
        fromLocation: route.fromLocation,
        toLocation: route.toLocation
      });
    } else if (trip.tripType === "Round Trip") {
      // Split round trip into 2 separate one way trips
      if (trip.departureTime) {
        // Outbound trip
        allTrips.push({
          ...trip,
          _id: `${trip._id}_outbound`,
          tripType: "One Way",
          direction: 'outbound',
          fromLocation: route.fromLocation,
          toLocation: route.toLocation,
          departureTime: trip.departureTime,
          arrivalTime: trip.arrivalTime,
          stopPoints: trip.outboundStopPoints || []
        });
      }
      
      if (trip.arrivalTime) {
        // Return trip  
        allTrips.push({
          ...trip,
          _id: `${trip._id}_return`,
          tripType: "One Way", 
          direction: 'return',
          fromLocation: route.toLocation,
          toLocation: route.fromLocation,
          departureTime: trip.arrivalTime,
          arrivalTime: null,
          stopPoints: trip.returnStopPoints || []
        });
      }
    }
  });

  const morningTrips = allTrips.filter(trip => 
    trip.direction === 'outbound' && trip.departureTime && trip.departureTime.includes('AM')
  );
  
  const eveningTrips = allTrips.filter(trip => 
    trip.direction === 'return' && trip.departureTime && trip.departureTime.includes('AM')
  );

  // Get pickup/dropoff points from selected trip
  const getPickupPoints = () => {
    if (selectedTrip) {
      // For morning trips, pickup is fromLocation
      if (selectedTrip.fromLocation === route.fromLocation) {
        return [route.fromLocation];
      }
      // For evening trips, pickup is toLocation
      return [route.toLocation];
    }
    return [route.fromLocation];
  };

  const getDropoffPoints = () => {
    if (selectedTrip) {
      // For morning trips, dropoff is toLocation
      if (selectedTrip.fromLocation === route.fromLocation) {
        return [route.toLocation];
      }
      // For evening trips, dropoff is fromLocation
      return [route.fromLocation];
    }
    return [route.toLocation];
  };

  const getReturnPickupPoints = () => {
    if (selectedReturnTrip) {
      // For return trips, pickup is fromLocation (which is route.toLocation)
      return [route.toLocation];
    }
    return [route.toLocation];
  };

  const getReturnDropoffPoints = () => {
    if (selectedReturnTrip) {
      // For return trips, dropoff is toLocation (which is route.fromLocation)
      return [route.fromLocation];
    }
    return [route.fromLocation];
  };

  const handleIncreaseSeats = () => {
    // Always limit to 1 seat per user
    if (numberOfSeats < 1) {
      setNumberOfSeats((prev) => prev + 1);
    }
  };

  const handleDecreaseSeats = () => {
    if (numberOfSeats > 1) {
      setNumberOfSeats((prev) => prev - 1);
    }
  };

  const handleContinueToPayment = () => {
    if (isCorporate) {
      handleCorporateBooking();
    } else {
      setStep(2);
    }
  };

  const handleSelectPaymentMethod = async (method) => {
    setPaymentMethod(method);
    setIsProcessing(true);

    // MONTHLY PASS BOOKING DATA
    const bookingData = {
      passengerId: user?.id || user?._id,
      routeId: route._id || route.id || route.routeId,
      scheduleId: scheduleData?._id || route.scheduleId || route._id, // Use schedule data ID
      passType: selectedPassType,
      outboundTripTime: selectedTrip?.departureTime || morningTrips[0]?.departureTime || allTrips[0]?.departureTime || '8:00 AM',
      returnTripTime: selectedReturnTrip?.departureTime || eveningTrips[0]?.departureTime || allTrips.find(t => t.direction === 'return')?.departureTime || '',
      pickupLocation: selectedPickupPoint || route.fromLocation,
      dropoffLocation: selectedDropoffPoint || route.toLocation,
      returnPickupLocation: selectedReturnPickupPoint || (selectedPassType === 'ROUND_TRIP' ? route.toLocation : ''),
      returnDropoffLocation: selectedReturnDropoffPoint || (selectedPassType === 'ROUND_TRIP' ? route.fromLocation : ''),
      durationMonths: passDuration,
      numberOfSeats: numberOfSeats, // 
      selectedDays: selectedDays, // Days user selected for travel
      totalAmount: Number.parseFloat(totalAmount),
      paymentMethod: method,
      notes: notes
    };

    try {
      const response = await api.post('/monthly-pass/create', bookingData);

      if (response.data.success) {
        // Handle payment redirect for STRIPE
        if (response.data.payment?.paymentUrl) {
          // Redirect to payment gateway (Stripe or TAP)
          console.log(
            "[v0] Redirecting to payment URL:",
            response.data.payment.paymentUrl,
          );
          window.location.href = response.data.payment.paymentUrl;
          return;
        } else if (method === "CASH") {
          // Show success message for cash payment
          console.log("[v0] Cash payment selected - showing success");
          setStep(3);
          setTimeout(() => {
            if (onSuccess) onSuccess();
          }, 2000);
        } else {
          // Payment method without redirect
          console.log("[v0] Payment method without redirect:", method);
          alert("Payment method not fully configured");
        }
      } else {
        console.error("Monthly pass creation failed:", response.data.message);
        alert(response.data.message || "Failed to create monthly pass");
      }
    } catch (err) {
      console.error("Booking error:", err);
      alert("Failed to create monthly pass. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCorporateBooking = async () => {
    setIsProcessing(true);

    // Validate driver is assigned for corporate booking
    const driverId = route.driverId || route.assignedDriverId;
    if (!driverId) {
      console.error("No driver assigned to this corporate route");
      setIsProcessing(false);
      alert(
        "This route has no assigned driver. Please contact your company administrator.",
      );
      return;
    }

    const bookingData = {
      routeId: route.routeId || route.id,
      contractId: route.contractId || null,
      corporateOwnerId: user.companyId,
      driverId: driverId,
      pickupLocation: route.fromLocation,
      dropoffLocation: route.toLocation,
      travelDate: new Date().toISOString(),
      numberOfSeats,
      travelPath: route.travelPath || [],
      vehicleModel: route.vehicleModel,
      vehiclePlate: route.vehiclePlate,
      driverName: route.driverName,
      driverImage: route.driverImage,
      passengerNotes: notes,
    };

    try {
      await dispatch(createCorporateBooking(bookingData)).unwrap();
    } catch (err) {
      console.error("Corporate booking error:", err);
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    dispatch(clearBookingData());
    setStep(1);
    setNumberOfSeats(1);
    setPaymentMethod("");
    setNotes("");
    setIsProcessing(false);
    onClose();
  };

  return (
    <div className="booking-modal-overlay" onClick={handleClose}>
      <div
        className="booking-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="booking-modal-header">
          <h2>
            {step === 1 && "Book Your Ride"}
            {step === 2 && "Select Payment Method"}
            {step === 3 && "Booking Confirmed"}
          </h2>
          <button className="close-btn" onClick={handleClose}>
            <FaTimes />
          </button>
        </div>

        <div className="booking-modal-body">
          {step === 1 && (
            <div className="step-content step-details">
              <div className="route-summary-card">
                <div className="route-summary-header">
                  <h3>Route Details</h3>
                </div>
                <div className="route-summary-body">
                  <div className="summary-row">
                    <FaMapMarkerAlt className="icon from" />
                    <div className="summary-info">
                      <span className="label">Pickup</span>
                      <span className="value">{route.fromLocation}</span>
                    </div>
                  </div>
                  <div className="summary-row">
                    <FaMapMarkerAlt className="icon to" />
                    <div className="summary-info">
                      <span className="label">Dropoff</span>
                      <span className="value">{route.toLocation}</span>
                    </div>
                  </div>
                  <div className="summary-row">
                    <FaUser className="icon" />
                    <div className="summary-info">
                      <span className="label">Driver</span>
                      <span className="value">
                        {route.driverName || "Assigned Driver"}
                      </span>
                    </div>
                  </div>
                  <div className="summary-row">
                    <FaBus className="icon" />
                    <div className="summary-info">
                      <span className="label">Vehicle</span>
                      <span className="value">
                        {route.vehicleModel || "Bus"} -{" "}
                        {route.vehiclePlate || "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* TRIP SELECTION */}
              <div className="trip-selection-card">
                <div className="trip-selection-header">
                  <h3>
                    {selectedPassType === "ROUND_TRIP" 
                      ? "Select Morning Trip (To Work)" 
                      : "Select Trip Time"
                    }
                  </h3>
                </div>
                <div className="trip-selection-body">
                  {loadingSchedule ? (
                    <div className="loading-schedule">
                      <FaSpinner className="spinner" />
                      <p>Loading schedule...</p>
                    </div>
                  ) : (
                    <>
                      {(selectedPassType === "ONE_WAY" ? allTrips : morningTrips).length > 0 ? (
                        (selectedPassType === "ONE_WAY" ? allTrips : morningTrips).map((trip, index) => (
                          <div 
                            key={trip._id || index}
                            className={`trip-option ${selectedTrip?._id === trip._id ? 'selected' : ''}`}
                            onClick={() => {
                              setSelectedTrip(trip);
                              // Use stop points from split trip data
                              const pickupStop = trip.stopPoints?.[0];
                              const dropoffStop = trip.stopPoints?.[trip.stopPoints?.length - 1];
                              setSelectedPickupPoint(pickupStop?.location || trip.fromLocation);
                              setSelectedDropoffPoint(dropoffStop?.location || trip.toLocation);
                            }}
                          >
                            <div className="trip-time">
                              <strong>{trip.departureTime}</strong>
                              {trip.arrivalTime && <span> - {trip.arrivalTime}</span>}
                              <span className="trip-type">{trip.direction === 'return' ? 'Return' : 'Outbound'}</span>
                            </div>
                            <div className="trip-route">
                              {trip.fromLocation} → {trip.toLocation}
                            </div>
                            <div className="trip-stops">
                              {trip.stopPoints?.slice(0, 2).map((stop, idx) => (
                                <span key={idx} className="stop-point">
                                  {stop.location} ({stop.time})
                                </span>
                              ))}
                              {trip.stopPoints?.length > 2 && <span>...</span>}
                            </div>
                            <div className="trip-seats">
                              {(() => {
                                // Get real-time seat availability for this trip time
                                const tripKey = `${trip.departureTime}_${trip.direction}`;
                                const seatInfo = tripSeatAvailability[tripKey];
                                const availableSeats = seatInfo?.availableSeats || route.availableSeats || route.totalSeats || 35;
                                const totalSeats = seatInfo?.totalSeats || route.totalSeats || 35;
                                
  
                                // Check if enough seats are available for selected number
                                const hasEnoughSeats = availableSeats >= numberOfSeats;
                                const seatStatus = hasEnoughSeats ? 'available' : 'limited';
                                
                                return (
                                  <div className={`seat-info ${seatStatus}`}>
                                    <span className="seat-count">{availableSeats} seats available</span>
                                    {numberOfSeats > 1 && (
                                      <span className="seat-request">
                                        ({numberOfSeats} needed)
                                      </span>
                                    )}
                                    {!hasEnoughSeats && (
                                      <span className="seat-warning">
                                        ⚠️ Not enough seats
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="no-trips">
                          {selectedPassType === "ROUND_TRIP" 
                            ? "No outbound trips available" 
                            : "No trips available in schedule"
                          }
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* RETURN TRIP SELECTION FOR ROUND TRIP */}
              {selectedPassType === "ROUND_TRIP" && (
                <div className="trip-selection-card">
                  <div className="trip-selection-header">
                    <h3>Select Evening Trip (Back Home)</h3>
                  </div>
                  <div className="trip-selection-body">
                    {loadingSchedule ? (
                      <div className="loading-schedule">
                        <FaSpinner className="spinner" />
                        <p>Loading schedule...</p>
                      </div>
                    ) : (
                      <>
                        {eveningTrips.length > 0 ? (
                          eveningTrips.map((trip, index) => (
                            <div 
                              key={trip._id || index}
                              className={`trip-option ${selectedReturnTrip?._id === trip._id ? 'selected' : ''}`}
                              onClick={() => {
                                setSelectedReturnTrip(trip);
                                // Use stop points from split trip data
                                const pickupStop = trip.stopPoints?.[0];
                                const dropoffStop = trip.stopPoints?.[trip.stopPoints?.length - 1];
                                setSelectedReturnPickupPoint(pickupStop?.location || trip.fromLocation);
                                setSelectedReturnDropoffPoint(dropoffStop?.location || trip.toLocation);
                              }}
                            >
                              <div className="trip-time">
                                <strong>{trip.departureTime}</strong>
                                {trip.arrivalTime && <span> - {trip.arrivalTime}</span>}
                                <span className="trip-type">{trip.direction === 'return' ? 'Return' : 'Outbound'}</span>
                              </div>
                              <div className="trip-route">
                                {trip.fromLocation} → {trip.toLocation}
                              </div>
                              <div className="trip-stops">
                                {trip.stopPoints?.slice(0, 2).map((stop, idx) => (
                                  <span key={idx} className="stop-point">
                                    {stop.location} ({stop.time})
                                  </span>
                                ))}
                                {trip.stopPoints?.length > 2 && <span>...</span>}
                              </div>
                              <div className="trip-seats">
                              {(() => {
                                // Get real-time seat availability for this return trip time
                                const tripKey = `${trip.departureTime}_${trip.direction}`;
                                const seatInfo = tripSeatAvailability[tripKey];
                                const availableSeats = seatInfo?.availableSeats || route.availableSeats || route.totalSeats || 35;
                                const totalSeats = seatInfo?.totalSeats || route.totalSeats || 35;
                                
  
                                // Check if enough seats are available for selected number
                                const hasEnoughSeats = availableSeats >= numberOfSeats;
                                const seatStatus = hasEnoughSeats ? 'available' : 'limited';
                                
                                return (
                                  <div className={`seat-info ${seatStatus}`}>
                                    <span className="seat-count">{availableSeats} seats available</span>
                                    {numberOfSeats > 1 && (
                                      <span className="seat-request">
                                        ({numberOfSeats} needed)
                                      </span>
                                    )}
                                    {!hasEnoughSeats && (
                                      <span className="seat-warning">
                                        ⚠️ Not enough seats
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                            </div>
                          ))
                        ) : (
                          <div className="no-trips">No return trips available</div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* PASS TYPE SELECTION */}
              <div className="pass-type-card">
                <div className="pass-type-header">
                  <h3>Select Pass Type</h3>
                </div>
                <div className="pass-type-body">
                  <div className="pass-type-options">
                    <label className="pass-type-option">
                      <input
                        type="radio"
                        name="passType"
                        value="ONE_WAY"
                        checked={selectedPassType === "ONE_WAY"}
                        onChange={(e) => {
                          setSelectedPassType(e.target.value);
                          // Reset return trip when switching to ONE_WAY
                          setSelectedReturnTrip(null);
                          setSelectedReturnPickupPoint('');
                          setSelectedReturnDropoffPoint('');
                        }}
                      />
                      <div className="pass-type-content">
                        <div className="pass-type-title">One Way Monthly Pass</div>
                        <div className="pass-type-price">{currency} {(route.pricing?.monthlyOneWayPrice || route.monthlyPrice || 3000).toFixed(currencyDecimals)}/month</div>
                        <div className="pass-type-description">
                          Travel in one direction only (e.g., morning to work)
                        </div>
                      </div>
                    </label>
                    
                    <label className="pass-type-option">
                      <input
                        type="radio"
                        name="passType"
                        value="ROUND_TRIP"
                        checked={selectedPassType === "ROUND_TRIP"}
                        onChange={(e) => {
                          setSelectedPassType(e.target.value);
                          // Reset trips when switching to ROUND_TRIP
                          setSelectedTrip(null);
                          setSelectedReturnTrip(null);
                          setSelectedPickupPoint('');
                          setSelectedDropoffPoint('');
                          setSelectedReturnPickupPoint('');
                          setSelectedReturnDropoffPoint('');
                        }}
                      />
                      <div className="pass-type-content">
                        <div className="pass-type-title">Round Trip Monthly Pass</div>
                        <div className="pass-type-price">{currency} {(route.pricing?.monthlyRoundTripPrice || 6000).toFixed(currencyDecimals)}/month</div>
                        <div className="pass-type-description">
                          Travel both directions (e.g., morning to work + evening back home)
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* PICKUP/DROPOFF POINTS */}
              {selectedTrip && (
                <div className="points-selection-card">
                  <div className="points-selection-header">
                    <h3>
                      {selectedPassType === "ROUND_TRIP" 
                        ? "Morning Boarding Points (To Work)" 
                        : "Select Boarding Points"
                      }
                    </h3>
                  </div>
                  <div className="points-selection-body">
                    <div className="point-selector">
                      <label>Pickup Point</label>
                      <select
                        value={selectedPickupPoint}
                        onChange={(e) => setSelectedPickupPoint(e.target.value)}
                        className="point-select"
                      >
                        <option value="">Select pickup point</option>
                        {getPickupPoints().map((point, index) => (
                          <option key={index} value={point}>{point}</option>
                        ))}
                      </select>
                    </div>
                    <div className="point-selector">
                      <label>Dropoff Point</label>
                      <select
                        value={selectedDropoffPoint}
                        onChange={(e) => setSelectedDropoffPoint(e.target.value)}
                        className="point-select"
                      >
                        <option value="">Select dropoff point</option>
                        {getDropoffPoints().map((point, index) => (
                          <option key={index} value={point}>{point}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* RETURN TRIP POINTS FOR ROUND TRIP */}
              {selectedPassType === "ROUND_TRIP" && selectedReturnTrip && (
                <div className="points-selection-card">
                  <div className="points-selection-header">
                    <h3>Evening Boarding Points (Back Home)</h3>
                  </div>
                  <div className="points-selection-body">
                    <div className="point-selector">
                      <label>Pickup Point</label>
                      <select
                        value={selectedReturnPickupPoint}
                        onChange={(e) => setSelectedReturnPickupPoint(e.target.value)}
                        className="point-select"
                      >
                        <option value="">Select pickup point</option>
                        {getReturnPickupPoints().map((point, index) => (
                          <option key={index} value={point}>{point}</option>
                        ))}
                      </select>
                    </div>
                    <div className="point-selector">
                      <label>Dropoff Point</label>
                      <select
                        value={selectedReturnDropoffPoint}
                        onChange={(e) => setSelectedReturnDropoffPoint(e.target.value)}
                        className="point-select"
                      >
                        <option value="">Select dropoff point</option>
                        {getReturnDropoffPoints().map((point, index) => (
                          <option key={index} value={point}>{point}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* TRAVEL DAYS SELECTION */}
              <div className="days-selection-card">
                <div className="days-selection-header">
                  <h3><FaCalendarAlt style={{marginRight: 8}} />Select Travel Days</h3>
                  <span className="days-count">{selectedDays.length} days/week</span>
                </div>
                <div className="days-selection-body">
                  <div className="days-grid">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                      const routeDays = route.availableDays || route.schedule?.availableDays || [];
                      const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                      let allowedDays = allDays;
                      if (Array.isArray(routeDays) && routeDays.length > 0) {
                        allowedDays = routeDays.map(d => d.charAt(0).toUpperCase() + d.slice(1).toLowerCase());
                      }
                      const isAllowed = allowedDays.includes(day);
                      const isSelected = selectedDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          className={`day-chip ${isSelected ? 'selected' : ''} ${!isAllowed ? 'disabled' : ''}`}
                          onClick={() => toggleDay(day)}
                          disabled={!isAllowed}
                          title={!isAllowed ? 'Route not available on this day' : ''}
                        >
                          {day.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                  <div className="days-presets">
                    <button type="button" className="preset-btn" onClick={() => setSelectedDays(['Monday','Tuesday','Wednesday','Thursday','Friday'])}>Weekdays</button>
                    <button type="button" className="preset-btn" onClick={() => setSelectedDays(['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'])}>All Days</button>
                    <button type="button" className="preset-btn" onClick={() => setSelectedDays(['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'])}>Mon-Sat</button>
                  </div>
                </div>
              </div>

              {/* PASS DURATION */}
              <div className="duration-card">
                <div className="duration-header">
                  <h3>Pass Duration</h3>
                </div>
                <div className="duration-body">
                  <div className="duration-selector">
                    <label>Number of Months</label>
                    <select
                      value={passDuration}
                      onChange={(e) => setPassDuration(parseInt(e.target.value))}
                      className="duration-select"
                    >
                      <option value={1}>1 Month</option>
                      <option value={3}>3 Months (5% off)</option>
                      <option value={6}>6 Months (10% off)</option>
                      <option value={12}>12 Months (15% off)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="seats-selector">
                <label>Number of Seats</label>
                <div className="seats-control">
                  <button
                    className="seats-btn"
                    onClick={handleDecreaseSeats}
                    disabled={numberOfSeats <= 1}
                  >
                    <FaMinus />
                  </button>
                  <span className="seats-count">{numberOfSeats}</span>
                  <button
                    className="seats-btn"
                    onClick={handleIncreaseSeats}
                    disabled={numberOfSeats >= 1}
                  >
                    <FaPlus />
                  </button>
                </div>
                <span className="seats-available">
                  1 seat per user
                </span>
              </div>

              <div className="notes-input">
                <label>Additional Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any special requirements or notes..."
                  rows={3}
                />
              </div>

              <div className="price-breakdown">
                <div className="price-row">
                  <span>Pass Type</span>
                  <span>{selectedPassType === "ONE_WAY" ? "One Way Monthly" : "Round Trip Monthly"}</span>
                </div>
                <div className="price-row">
                  <span>Per Day Rate</span>
                  <span>{currency} {perDayPrice.toFixed(currencyDecimals)}/day</span>
                </div>
                <div className="price-row">
                  <span>Travel Days/Month</span>
                  <span>~{travelDaysPerMonth} days ({selectedDays.length} days/week)</span>
                </div>
                <div className="price-row">
                  <span>Monthly Price (per seat)</span>
                  <span>{currency} {pricePerMonth.toFixed(currencyDecimals)}</span>
                </div>
                <div className="price-row">
                  <span>Number of seats</span>
                  <span>x {numberOfSeats}</span>
                </div>
                <div className="price-row">
                  <span>Duration</span>
                  <span>{passDuration} month{passDuration > 1 ? 's' : ''}</span>
                </div>
                {/* {!isCorporate && (
                  <>
                    <div className="price-row sub">
                      <span>Admin Commission (20%)</span>
                      <span>{currency} {adminCommission}</span>
                    </div>
                    <div className="price-row sub">
                      <span>Driver Earnings (80%)</span>
                      <span>{currency} {driverEarnings}</span>
                    </div>
                  </>
                )} */}
                <div className="price-row total">
                  <span>Total Amount ({passDuration} month{passDuration > 1 ? 's' : ''})</span>
                  <span>{currency} {totalAmount}</span>
                </div>
                <div className="savings-info">
                  {passDuration > 1 && (
                    <span className="savings-text">
                      💰 Save {passDuration === 3 ? '5%' : passDuration === 6 ? '10%' : '15%'} with longer duration!
                    </span>
                  )}
                </div>
              </div>

              {isCorporate && (
                <div className="corporate-notice">
                  <FaCheck className="notice-icon" />
                  <span>
                    As a corporate employee, no payment is required. Your
                    company covers the cost.
                  </span>
                </div>
              )}

              {error && <div className="error-message">{error}</div>}

              <div className="modal-actions">
                <button className="btn-secondary" onClick={handleClose}>
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={handleContinueToPayment}
                  disabled={loading || isProcessing}
                >
                  {loading || isProcessing ? (
                    <>
                      <FaSpinner className="spinner" /> Processing...
                    </>
                  ) : isCorporate ? (
                    "Confirm Booking"
                  ) : (
                    "Continue to Payment"
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="step-content step-payment">
              <div className="payment-amount-display">
                <span className="amount-label">Amount to Pay</span>
                <span className="amount-value">{currency} {totalAmount}</span>
              </div>

              {/* <div className="commission-info">
                <div className="commission-row">
                  <span>Admin Commission (20%)</span>
                  <span>{currency} {adminCommission}</span>
                </div>
                <div className="commission-row highlight">
                  <span>Driver Earnings (80%)</span>
                  <span>{currency} {driverEarnings}</span>
                </div>
              </div> */}

              <div className="payment-methods">
                <h3>Choose Payment Method</h3>
                <div className="payment-options">
                  <div
                    className={`payment-option ${paymentMethod === "STRIPE" ? "selected" : ""} ${isProcessing ? "disabled" : ""}`}
                    onClick={() =>
                      !isProcessing && handleSelectPaymentMethod("STRIPE")
                    }
                  >
                    <div className="option-icon">
                      <FaCreditCard />
                    </div>
                    <div className="option-info">
                      <span className="option-title">Credit/Debit Card</span>
                      <span className="option-desc">
                        Pay securely with Stripe
                      </span>
                    </div>
                    {paymentMethod === "STRIPE" && isProcessing && (
                      <FaSpinner className="processing-spinner" />
                    )}
                  </div>

                  <div
                    className={`payment-option ${paymentMethod === "TAP" ? "selected" : ""} ${isProcessing ? "disabled" : ""}`}
                    onClick={() =>
                      !isProcessing && handleSelectPaymentMethod("TAP")
                    }
                  >
                    <div className="option-icon">
                      <FaUniversity />
                    </div>
                    <div className="option-info">
                      <span className="option-title">Tap Payments</span>
                      <span className="option-desc">
                        Card, Apple Pay, Google Pay
                      </span>
                    </div>
                    {paymentMethod === "TAP" && isProcessing && (
                      <FaSpinner className="processing-spinner" />
                    )}
                  </div>

                  <div
                    className={`payment-option ${paymentMethod === "CASH" ? "selected" : ""} ${isProcessing ? "disabled" : ""}`}
                    onClick={() =>
                      !isProcessing && handleSelectPaymentMethod("CASH")
                    }
                  >
                    <div className="option-icon">
                      <FaMoneyBillWave />
                    </div>
                    <div className="option-info">
                      <span className="option-title">Cash Payment</span>
                      <span className="option-desc">Pay to driver on ride</span>
                    </div>
                    {paymentMethod === "CASH" && isProcessing && (
                      <FaSpinner className="processing-spinner" />
                    )}
                  </div>
                </div>
              </div>

              {error && <div className="error-message">{error}</div>}

              <div className="modal-actions">
                <button
                  className="btn-secondary"
                  onClick={() => setStep(1)}
                  disabled={isProcessing}
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="step-content step-success">
              <div className="success-icon">
                <FaCheck />
              </div>
              <h3>Booking Confirmed!</h3>
              <p className="success-message">
                {isCorporate
                  ? "Your corporate booking has been confirmed. Your company has been notified."
                  : paymentMethod === "CASH"
                    ? "Your booking is pending. Please pay the driver when you board."
                    : "Your booking has been confirmed and payment received."}
              </p>

              <div className="booking-confirmation-details">
                <div className="detail-row">
                  <span className="detail-label">Booking ID</span>
                  <span className="detail-value">
                    {currentBooking?._id || "Generating..."}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Pickup</span>
                  <span className="detail-value">{route.fromLocation}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Dropoff</span>
                  <span className="detail-value">{route.toLocation}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Seats</span>
                  <span className="detail-value">{numberOfSeats}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Total Amount</span>
                  <span className="detail-value">{currency} {totalAmount}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Payment Method</span>
                  <span className="detail-value">
                    {isCorporate ? "Corporate" : paymentMethod}
                  </span>
                </div>
              </div>

              <div className="modal-actions">
                <button className="btn-primary" onClick={handleClose}>
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookingModal;
