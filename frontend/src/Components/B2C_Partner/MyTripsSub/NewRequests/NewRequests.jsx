import TripCard from "../TripCard/TripCard";
import "./newrequests.css";

function NewRequests() {
  const trips = [
    {
      id: "TRP-8001",
      date: "12/9/2025",
      time: "10:11 AM",
      fare: "5.554 KWD",
      pickup: "Farwaniya",
      dropoff: "Mangaf",
      passenger: "N/A",
      status: "available",
      type: "new",
    },
    {
      id: "TRP-8002",
      date: "12/9/2025",
      time: "05:24 AM",
      fare: "17.208 KWD",
      pickup: "Farwaniya",
      dropoff: "Salwa",
      passenger: "N/A",
      status: "available",
      type: "new",
    },
    {
      id: "TRP-8007",
      date: "12/8/2025",
      time: "11:52 PM",
      fare: "12.782 KWD",
      pickup: "Mahboula",
      dropoff: "Fahaheel",
      passenger: "N/A",
      status: "available",
      type: "new",
    },
    {
      id: "TRP-8000",
      date: "12/8/2025",
      time: "06:28 PM",
      fare: "17.947 KWD",
      pickup: "Hawally",
      dropoff: "Salwa",
      passenger: "N/A",
      status: "available",
      type: "new",
    },
    {
      id: "TRP-8003",
      date: "12/8/2025",
      time: "06:22 PM",
      fare: "13.635 KWD",
      pickup: "Khaltan",
      dropoff: "Jahra",
      passenger: "N/A",
      status: "available",
      type: "new",
    },
    {
      id: "TRP-8004",
      date: "12/8/2025",
      time: "02:12 PM",
      fare: "10.718 KWD",
      pickup: "Mangaf",
      dropoff: "Salmiya",
      passenger: "N/A",
      status: "available",
      type: "new",
    },
    {
      id: "TRP-8006",
      date: "12/8/2025",
      time: "01:58 PM",
      fare: "11.911 KWD",
      pickup: "Hawally",
      dropoff: "Jahra",
      passenger: "N/A",
      status: "available",
      type: "new",
    },
  ];

  return (
    <div className="new-requests">

      <div className="trips-grid">
        {trips.map((trip) => (
          <TripCard
            key={trip.id}
            trip={trip}
            showButton={true}
            buttonText="Accept Trip"
            buttonStyle="primary"
          />
        ))}
      </div>
    </div>
  );
}

export default NewRequests;
