// --- Imports & Config ---
import {setGlobalOptions} from "firebase-functions/v2";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

// Initialization as admin
admin.initializeApp();

// Safety settings
setGlobalOptions({ 
	region: "us-central1",
	maxInstances: 10
 }); // Need to keep this to prevent surprising bills. Never run more than 10 copies of my code at once.

// --- Function 1: Staff Management ---
// Creates a staff user and assigns the 'staff' custom claim
export const createStaff = onCall(async (request) => { // onCall is more modern way. Firebase SDK does auth/JWT token part. By putting async, it enables await. export make public API

	// Security check: is the caller authenticated?
	if (!request.auth){
		throw new HttpsError("unauthenticated", "Auth required.");
	}

	// Security check: is the caller an admin?
	if (request.auth.token.role !== "admin") {
		throw new HttpsError("permission-denied", "Admin only.");
	}

    // This is called Destructuring Assignment. Data does not exist until this func is called that is why it has to be inside of the function.
	const { email, password, displayName, role } = request.data; // Getting data from frontside.
    
	if (!email || !password || typeof email !== "string" || typeof password !== "string") {
        throw new HttpsError("invalid-argument", "Email and password are required strings.");
    }

	try {
		// 1. This handles the email,password,display name part
		const userRecord = await admin.auth().createUser({ // By adding await, it waits for the google server response, and then proceed next line
			email,
			password,
			displayName
		});

		// 2. Set Custom Claims Adding staff role
		await admin.auth().setCustomUserClaims(userRecord.uid, { // By adding await, it waits for the google server response, and then proceed next line
            role: role || "staff" // role = role or "staff", "staff" as a fallback
        });

		return {
			uid: userRecord.uid,
			message: "Staff member created successfully."
		}

	} catch (error: any) {
		logger.error("Error creating staff:", error);

		// Handling common Firebase error
		if (error.code === 'auth/email-already-exists') {
			throw new HttpsError("already-exists", "This email is already in use.");
		}
        if (error.code === 'auth/invalid-email') {
            throw new HttpsError("invalid-argument", "The email address is badly formatted.");
        }
        if (error.code === 'auth/invalid-password') {
            throw new HttpsError("invalid-argument", "Password must be at least 6 characters.");
        }

        // Throw generic error message
		throw new HttpsError("internal", "Failed to create staff member.");
	}
});