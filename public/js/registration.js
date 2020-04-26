/*
Adapted from https://www.templatemonster.com/blog/html5-css3-registration-forms/
*/
//code for unmasking password
$('.unmask').on('click', function(){
  if($(this).prev('input').attr('type') == 'password')
    $(this).prev('input').prop('type', 'text');
  else
    $(this).prev('input').prop('type', 'password');
  return false;
});

//Check that passwords match
$('.password').on('keyup',function (){
  var p_c = $('#password-confirm');
  var p = $('#password');
  if(p.val().length > 0) {
    if(p.val() != p_c.val()) {
      $('#valid').html("Passwords Don't Match");
      $('#valid').show('fast');
    } else {
       $('#valid').html('');
       $('#valid').hide();
       $('#submit-button').show('fast');
    }
  }
});
