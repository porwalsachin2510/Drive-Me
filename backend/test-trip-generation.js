import { generateTripsForSchedule } from './src/Services/tripGenerationService.js';

// Test with the specific schedule ID from the user
const scheduleId = '69889a831d13cfe4364dab15';

console.log('Testing trip generation for schedule:', scheduleId);

generateTripsForSchedule(scheduleId, 7)
  .then(result => {
    console.log('Trip generation result:', result);
  })
  .catch(error => {
    console.error('Trip generation error:', error);
  });
