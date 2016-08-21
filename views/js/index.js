$(document).ready(function() {
	$("#generate").submit(function(event) {
		event.preventDefault();
		$.post("/new/room", function(data) {
			window.location.href = "/room/" + data;
		});
	});
});
