var config = {
	dev: {
		host: "localhost:3000",
		/*
		interjectSocketFunction: function (e) {
			console.log(e);
		}
		*/
	},
	prod: {
		host: "api.mondora.com",
		ssl: true
	}
};
var cfg;
if (/b/.test(APP_VERSION)) {
	cfg = config.dev;
} else {
	cfg = config.prod;
}

Appriporta = new Asteroid(cfg.host, cfg.ssl, cfg.interjectSocketFunction);
document.addEventListener("DOMContentLoaded", function () {
	var loginButton = document.getElementById("login");
	var logoutButton = document.getElementById("logout");
	var openButton = document.getElementById("open");
	Appriporta.on("login", function () {
		loginButton.style.display = "none";
		openButton.style.display = "initial";
		logoutButton.style.display = "initial";
	});
	Appriporta.on("logout", function () {
		loginButton.style.display = "initial";
		openButton.style.display = "none";
		logoutButton.style.display = "none";
	});
	loginButton.addEventListener("click", function () {
		Appriporta.loginWithTwitter();
	}, false);
	logoutButton.addEventListener("click", function () {
		Appriporta.logout();
	}, false);
	openButton.addEventListener("click", function () {
		Appriporta.call("openOfficeDoor");
	}, false);
});
