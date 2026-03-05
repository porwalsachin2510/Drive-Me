import HistoryTripCard from "../HistoryTripCard/HistoryTripCard";
import "./mytripshistory.css";

function MyTripsHistory() {
  const trips = [
    {
      id: "TRP-8019",
      date: "11/5/2025",
      time: "05:30 AM",
      fare: "6.561 KWD",
      pickup: "Kuwait City",
      dropoff: "Mahboula",
      passenger: "Sarah Smith",
      status: "completed",
    },
    {
      id: "TRP-8010",
      date: "9/9/2025",
      time: "05:30 AM",
      fare: "13.259 KWD",
      pickup: "Salmiya",
      dropoff: "Farwaniya",
      passenger: "Abdullah Al-Mutairi",
      status: "cancelled",
    },
    {
      id: "TRP-8015",
      date: "9/1/2025",
      time: "05:30 AM",
      fare: "4.450 KWD",
      pickup: "Jahra",
      dropoff: "Mangaf",
      passenger: "Ahmed Al-Sabah",
      status: "completed",
    },
    {
      id: "TRP-8013",
      date: "5/31/2025",
      time: "05:30 AM",
      fare: "8.916 KWD",
      pickup: "Farwaniya",
      dropoff: "Salmiya",
      passenger: "Mariam Al-Ali",
      status: "completed",
    },
    {
      id: "TRP-8005",
      date: "2/23/2025",
      time: "05:30 AM",
      fare: "17.000 KWD",
      pickup: "Mahboula",
      dropoff: "Fahaheel",
      passenger: "Layla Smith",
      status: "completed",
    },
    {
      id: "TRP-8011",
      date: "11/11/2024",
      time: "05:30 AM",
      fare: "10.548 KWD",
      pickup: "Mahboula",
      dropoff: "Khaitan",
      passenger: "Fatima Al-Enezi",
      status: "cancelled",
    },
    {
      id: "TRP-8018",
      date: "10/9/2024",
      time: "05:30 AM",
      fare: "8.982 KWD",
      pickup: "Kuwait City",
      dropoff: "Farwaniya",
      passenger: "Fahad Smith",
      status: "cancelled",
    },
    {
      id: "TRP-8017",
      date: "5/22/2024",
      time: "05:30 AM",
      fare: "4.036 KWD",
      pickup: "Salwa",
      dropoff: "Jahra",
      passenger: "Abdullah Al-Mutairi",
      status: "cancelled",
    },
    {
      id: "TRP-8009",
      date: "2/24/2024",
      time: "05:30 AM",
      fare: "17.725 KWD",
      pickup: "Jahra",
      dropoff: "Salwa",
      passenger: "Ahmed Al-Enezi",
      status: "completed",
    },
  ];

  return (
    <div className="history">
      <div className="trips-grid">
        {trips.map((trip) => (
          <HistoryTripCard key={trip.id} trip={trip} />
        ))}
      </div>
    </div>
  );
}

export default MyTripsHistory;
