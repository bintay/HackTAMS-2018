function toggleTimeDisplay (e) {
   var timeElement = document.getElementById('timeInputs');
   var checkElement = document.getElementById('hasTime');
   if (checkElement.checked) {
      timeElement.classList.remove('hidden');
   } else {
      timeElement.classList.add('hidden');
   }
}

function toggleVolunteerDisplay (e) {
   var volunteerElement = document.getElementById('volunteerInputs');
   var checkElement = document.getElementById('hasVolunteer');
   if (checkElement.checked) {
      volunteerElement.classList.remove('hidden');
   } else {
      volunteerElement.classList.add('hidden');
   }
}

document.onload = function (e) {
   toggleVolunteerDisplay();
   toggleTimeDisplay();
}
window.onload = function (e) {
   toggleVolunteerDisplay();
   toggleTimeDisplay();
}
