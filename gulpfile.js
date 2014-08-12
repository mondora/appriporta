//////////////////
// Dependencies //
//////////////////

var crypto		= require("crypto");
var fs			= require("fs");
var gulp		= require("gulp");
var plugins		= require("gulp-load-plugins")();
var http		= require("http");
var _			= require("lodash");
var mkdirp		= require("mkdirp");
var pp			= require("preprocess");
var Q			= require("q");
var spawn		= require("child_process").spawn;
var static		= require("node-static");
var util		= require("util");
var WebSocket	= require("faye-websocket");


//////////////////////////////////
// App files building functions //
//////////////////////////////////

var buildAppStyles = function (dest, minify) {
	var deferred = Q.defer();
	var step = gulp.src("app/**/*.scss")
		.pipe(plugins.sass())
		.pipe(plugins.concat("app.css"))
		.pipe(plugins.autoprefixer("last 3 version"))
		.pipe(gulp.dest(dest));
	if (minify) {
		step = step
			.pipe(plugins.minifyCss())
			.pipe(plugins.rename("app.min.css"))
			.pipe(gulp.dest(dest));
	}
	step.on("end", function () {
		deferred.resolve();
	});
	return deferred.promise;
};

var buildAppScripts = function (dest, minify) {
	var deferred = Q.defer();
	var step = gulp.src("app/**/*.js")
		.pipe(plugins.concat("app.js"))
		.pipe(gulp.dest(dest));
	if (minify) {
		step = step
			.pipe(plugins.uglify())
			.pipe(plugins.rename("app.min.js"))
			.pipe(gulp.dest(dest));
	}
	step.on("end", function () {
		deferred.resolve();
	});
	return deferred.promise;
};

/*
var buildAppFavicon = function (dest) {
	var deferred = Q.defer();
	var step = gulp.src("app/favicon.ico").pipe(gulp.dest(dest));
	step.on("end", function () {
		deferred.resolve();
	});
	return deferred.promise;
};

var buildAppVersion = function (dest) {
	var deferred = Q.defer();
	var step = gulp.src("app/VERSION").pipe(gulp.dest(dest));
	step.on("end", function () {
		deferred.resolve();
	});
	return deferred.promise;
};
*/

/////////////////////////////////////
// Vendor files building functions //
/////////////////////////////////////

var buildVendorScripts = function (dest, minify) {
	var deferred = Q.defer();
	var sources = [
		"bower_components/q/q.js",
		"bower_components/ddp.js/src/ddp.js",
		"bower_components/asteroid/dist/asteroid.js"
	];
	var step = gulp.src(sources)
		.pipe(plugins.concat("vendor.js"))
		.pipe(gulp.dest(dest));
	if (minify) {
		step = step
			.pipe(plugins.uglify())
			.pipe(plugins.rename("vendor.min.js"))
			.pipe(gulp.dest(dest));
	}
	step.on("end", function () {
		deferred.resolve();
	});
	return deferred.promise;
};

//////////////////////
// Build for mobile //
//////////////////////

gulp.task("buildMobileDev", function () {

	mkdirp.sync("builds/app/www/dist/js");
	mkdirp.sync("builds/app/www/dist/css");

	// index.html
	var html = fs.readFileSync("app/main.html", "utf8");
	var mobileHtml = pp.preprocess(html, {TARGET: "mobile.dev"});
	fs.writeFileSync("builds/app/www/index.html", mobileHtml);

	return Q.all([
		// Scripts
		buildAppScripts("builds/app/www/dist/js", true),
		buildVendorScripts("builds/app/www/dist/js", true),
		// Styles
		buildAppStyles("builds/app/www/dist/css", true),
		// Favicon
		//buildAppFavicon("builds/app/www"),
		// Version
		//buildAppVersion("builds/app/www")
	]);

});

gulp.task("buildMobile", function () {

	mkdirp.sync("builds/app/www/dist/js");
	mkdirp.sync("builds/app/www/dist/css");

	// index.html
	var html = fs.readFileSync("app/main.html", "utf8");
	var mobileHtml = pp.preprocess(html, {TARGET: "mobile.prod"});
	fs.writeFileSync("builds/app/www/index.html", mobileHtml);

	return Q.all([
		// Scripts
		buildAppScripts("builds/app/www/dist/js", true),
		buildVendorScripts("builds/app/www/dist/js", true),
		// Styles
		buildAppStyles("builds/app/www/dist/css", true),
		// Favicon
		//buildAppFavicon("builds/app/www"),
		// Version
		//buildAppVersion("builds/app/www")
	]);

});

///////////////////////////
// Start dev environment //
///////////////////////////

var buildDevCss = function () {
	console.log("Building css... ");
	mkdirp.sync("builds/dev/dist/css");
	return Q.all([
		buildAppStyles("builds/dev/dist/css")
	]);
};

var buildDevJs = function () {
	console.log("Building js... ");
	mkdirp.sync("builds/dev/dist/js");
	return Q.all([
		buildAppScripts("builds/dev/dist/js"),
		buildVendorScripts("builds/dev/dist/js")
	]);
};

var buildDevHtml = function () {
	console.log("Building html... ");
	var html = fs.readFileSync("app/main.html", "utf8");
	var devHtml = pp.preprocess(html, {TARGET: "dev"});
	fs.writeFileSync("builds/dev/index.html", devHtml);
	return Q();
};

/*
var buildDevFavicon = function () {
	console.log("Building favicon... ");
	return buildAppFavicon("builds/dev");
};

var buildDevVersion = function () {
	console.log("Building version... ");
	return buildAppVersion("builds/dev");
};
*/

gulp.task("dev", function () {
	buildDevJs();
	buildDevCss();
	buildDevHtml();
	//buildDevFavicon();
	//buildDevVersion();

	// Set up static file server
	var file = new static.Server("./builds/dev/");
	http.createServer(function (req, res) {
		req.on("end", function () {
			file.serve(req, res);
		}).resume();
	}).listen(8080, "0.0.0.0");

	// Set up WebSocket server to reload the browser
	var ws = {
		sockets: {},
		send: function (msg) {
			_.forEach(this.sockets, function (socket) {
				socket.send(msg);
			});
		}
	};
	http.createServer().on("upgrade", function (req, sock, body) {
		var key = crypto.randomBytes(16).toString("hex");
		if (WebSocket.isWebSocket(req)) {
			ws.sockets[key] = new WebSocket(req, sock, body).on("close", function () {
				delete ws.sockets[key];
			});
		}
	}).listen(8000, "0.0.0.0");

	var scssWatcher = gulp.watch("app/**/*.scss");
	var scssHandler = _.throttle(function () {
		buildDevCss()
			.then(function () {
				ws.send("reload");
			});
	}, 1000);
	scssWatcher.on("change", scssHandler);

	var jsWatcher = gulp.watch(["app/**/*.html", "!app/main.html", "app/**/*.js"]);
	var jsHandler = _.throttle(function () {
		buildDevJs()
			.then(function () {
				ws.send("reload");
			});
	}, 1000);
	jsWatcher.on("change", jsHandler);

	var htmlWatcher = gulp.watch("app/main.html");
	var htmlHandler = _.throttle(function () {
		buildDevHtml()
			.then(function () {
				ws.send("reload");
			});
	}, 1000);
	htmlWatcher.on("change", htmlHandler);

});



////////////////////////////
// Start test environment //
////////////////////////////

gulp.task("tdd", function () {
});



////////////////////
// Build all task //
////////////////////

gulp.task("buildAll", ["buildMac", "buildWeb"]);



///////////////////////////////////////
// Default task: prints help message //
///////////////////////////////////////

gulp.task("default", function () {
	console.log("");
	console.log("Usage: gulp [TASK]");
	console.log("");
	console.log("Available tasks:");
	console.log("  buildAll         builds mac and web");
	console.log("  buildWeb         builds the application to be served via web");
	console.log("  buildMac         builds the application to be served via the Mac App Store");
	console.log("  dev              set up dev environment with auto-recompiling");
	console.log("");
});
