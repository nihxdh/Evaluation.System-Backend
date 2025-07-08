require('dotenv').config();
const mongoose = require('mongoose');
const Assignment = require('./models/Assignment');

async function fixAssignments() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get all assignments
    const allAssignments = await Assignment.find({});
    console.log('Found', allAssignments.length, 'assignments');

    for (const assignment of allAssignments) {
      console.log(`\nFixing assignment: ${assignment.title}`);
      console.log(`Current targetYear: "${assignment.targetYear}"`);
      
      // Fix the targetYear based on the current value
      let newTargetYear;
      if (!assignment.targetYear || assignment.targetYear === '') {
        // Default to 1st year if no targetYear
        newTargetYear = '1st';
      } else if (assignment.targetYear === '2') {
        newTargetYear = '2nd';
      } else if (assignment.targetYear === '3') {
        newTargetYear = '3rd';
      } else if (assignment.targetYear === '4') {
        newTargetYear = '4th';
      } else if (assignment.targetYear === '1') {
        newTargetYear = '1st';
      } else {
        // If it's already in correct format, keep it
        newTargetYear = assignment.targetYear;
      }
      
      console.log(`New targetYear: "${newTargetYear}"`);
      
      // Update the assignment
      assignment.targetYear = newTargetYear;
      await assignment.save();
      console.log('Assignment updated successfully');
    }

    console.log('\n=== VERIFICATION ===');
    const updatedAssignments = await Assignment.find({});
    updatedAssignments.forEach((assignment, index) => {
      console.log(`${index + 1}. Title: ${assignment.title}`);
      console.log(`   Target Year: "${assignment.targetYear}" (type: ${typeof assignment.targetYear})`);
    });

    console.log('\nAll assignments fixed successfully!');

  } catch (error) {
    console.error('Fix error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

fixAssignments(); 