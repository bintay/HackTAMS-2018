window.onload = function () {
   var errors = document.getElementsByClassName('error');

   for (var error of errors) {
      error.onclick = function () {
         error.outerHTML = '';
      }
   }
}