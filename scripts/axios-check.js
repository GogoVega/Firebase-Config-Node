const { exec } = require("child_process");

// See https://github.com/theNetworkChuck/axios-attack-guide
const url = "https://raw.githubusercontent.com/theNetworkChuck/axios-attack-guide/refs/heads/main/check.sh";

exec(`curl -sL ${url} | bash`, (error, stdout, stderr) => {
	if (error) {
		console.error(error);
		return;
	}

	console.log(stdout, stderr);

	if (!stdout.includes("ALL CLEAR")) {
		throw new Error("Axios vulnerability found")
	}
});
