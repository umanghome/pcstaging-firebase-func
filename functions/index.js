const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
const moment = require('moment');

const dbRef = admin.database().ref('/'); // Reference to Firebase collection

const SLACK_TOKEN = ''; // Slack token obtained while configuring

/**
 * Endpoint: /get
 * Used for: Retrieving the status of Staging instances
 * Method expected: POST
 * Parameter(s) expected:
 *      - token {String} => Slack's token
 */
exports.get = functions.https.onRequest((req, res) => {
    dbRef.once('value', (snapshot) => {
        // If the token does not exist, throw an error
        if (!req.body.token) {
            res.status(400).send({
                status: false,
                message: 'Please add token field.',
            });
        }
        // If the token doesn't match, throw an error
        if (req.body.token !== SLACK_TOKEN) {
            res.status(403).send({
                status: false,
                message: 'Token mismatch'
            });
        }

        // Get data from Firebase
        const data = snapshot.val();
        let returnArray = [];

        // Create a string for each Staging instance
        for (let key in data) {
            let staging = data[key];
            returnArray.push(staging.user + ' is using ' + staging.name + ' at ' + staging.ip + ' for ' + staging.branch + ' since ' + staging.timeString);
        }

        // Join the strings into one and send as the respnse
        res.status(200).send(returnArray.join('\n'));
    });
});

/**
 * Endpoint: /update
 * Used for: Updating the status of a Staging instance
 * Method expected: POST
 * Parameter(s) expected:
 *      - token {String} => Slack's token
 *      - branch {String} => Name of the branch deployed on the Staging instance
 *      - user {String} => Name of the usre using the Staging instance
 *      - hostname {String} => Identity of the Staging instance
 */
exports.update = functions.https.onRequest((req, res) => {
    // Check for params
    if (!req.body.token || !req.body.branch || !req.body.user || !req.body.hostname) {
        res.status(400).send({
            status: false,
            message: 'Please add token, branch, user, and hostname fields.',
            body: req.body
        });
    }

    // Check Slack token
    if (req.body.token !== SLACK_TOKEN) {
        res.status(403).send({
            status: false,
            message: 'Token mismatch'
        });
    }

    // Extract params
    const {branch, user, hostname} = req.body;

    // Get all Staging's data from Firebase
    dbRef.once('value', (snapshot) => {
        const data = snapshot.val();
        let keyToUse = undefined; // Firebase key corresponding to the Staging we want to update
        let stagingToUse = undefined; // Existing data in Firebase corresponding to the Staging we want to update

        // Loop through all the Staging's data
        for (let key in data) {
            // If we found the hostname that matches, select it
            if (data[key].hostname && data[key].hostname === hostname) {
                keyToUse = key;
                stagingToUse = data[key];
                break;
            }
        }

        // Set default message
        let message = 'Did not update.';

        // If we found a matching Staging in our Firebase DB, update it
        if (keyToUse !== undefined && stagingToUse !== undefined) {
            // Set values
            stagingToUse.timestamp = moment().unix();
            stagingToUse.timeString = moment.unix(stagingToUse.timestamp).utcOffset('+05:30').format('hh:mm A MMMM Do, YYYY');
            stagingToUse.user = user;
            stagingToUse.branch = branch;

            // Update in Firebase
            dbRef.child(keyToUse).update(stagingToUse);

            // Set message
            message = 'Updated.';
        }

        // Send response
        res.status(200).send({
            status: true,
            message: message
        });
    });
});
