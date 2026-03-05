// Script to update existing B2C providers with status field
const mongoose = require('mongoose');
const User = require('./src/models/User.js');

async function updateB2CProvidersStatus() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/driveme', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB');
    
    // Find all B2C partners without status field
    const b2cProviders = await User.find({ 
      role: 'B2C_PARTNER',
      status: { $exists: false }
    });
    
    console.log(`Found ${b2cProviders.length} B2C providers without status field`);
    
    if (b2cProviders.length > 0) {
      // Update all B2C providers to have status = "PENDING"
      const result = await User.updateMany(
        { 
          role: 'B2C_PARTNER',
          status: { $exists: false }
        },
        { 
          $set: { 
            status: 'PENDING',
            activatedAt: null,
            suspendedAt: null,
            activatedBy: null,
            suspendedBy: null
          }
        }
      );
      
      console.log(`Updated ${result.modifiedCount} B2C providers with status field`);
    }
    
    // Check final status
    const finalCheck = await User.find({ role: 'B2C_PARTNER' });
    console.log('\nFinal B2C Provider Status:');
    finalCheck.forEach(provider => {
      console.log(`- ${provider.fullName}: ${provider.status || 'NO STATUS FIELD'}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\nDisconnected from MongoDB');
  }
}

updateB2CProvidersStatus();
