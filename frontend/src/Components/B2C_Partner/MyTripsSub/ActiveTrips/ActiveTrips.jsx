import ActiveTripCard from "../ActiveTripCard/ActiveTripCard";
import "./activetrips.css";

function ActiveTrips() {
  const trips = [
    {
      id: "TRP-8016",
      date: "8/30/2025",
      time: "05:30 AM",
      fare: "6.636 KWD",
      pickup: "Salmiya",
      dropoff: "Farwaniya",
      passenger: "Yousef Al-Ali",
      status: "active",
    },
    {
      id: "TRP-8014",
      date: "3/31/2025",
      time: "05:30 AM",
      fare: "12.523 KWD",
      pickup: "Kuwait City",
      dropoff: "Mangaf",
      passenger: "Hassan Khan",
      status: "active",
    },
    {
      id: "TRP-8012",
      date: "1/3/2025",
      time: "05:30 AM",
      fare: "16.657 KWD",
      pickup: "Khaitan",
      dropoff: "Mahboula",
      passenger: "Omar Khan",
      status: "active",
    },
    {
      id: "TRP-8008",
      date: "3/5/2024",
      time: "05:30 AM",
      fare: "15.319 KWD",
      pickup: "Salmiya",
      dropoff: "Fahaheel",
      passenger: "Omar Al-Sabah",
      status: "active",
    },
  ];

  return (
    <div className="active-trips">

      <div className="trips-grid">
        {trips.map((trip) => (
          <ActiveTripCard key={trip.id} trip={trip} />
        ))}
      </div>
    </div>
  );
}

export default ActiveTrips;
