// --- Imports & Config ---
import {setGlobalOptions} from "firebase-functions/v2";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { FieldValue } from "firebase-admin/firestore";

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

// --- Function 2: Adding Points ---
// Add points when the QR code is scanned. No need to put "await" because when this is called, right away it gets executed
export const addPoint = onCall(async (request) => {

	// Security check: is the caller authenticated?
	if (!request.auth){
		throw new HttpsError("unauthenticated", "Auth required.");
	}

	// Check if the role is staff or admin, otherwise, throw an error
	const authorizedRoles = ["admin", "staff"];
	const role = request.auth.token.role; 
	if (!authorizedRoles.includes(role)) { // if the role is not on the list defined = it is not admin or staff
		throw new HttpsError("permission-denied", "FORBIDDEN");
	}

	// Get the customer uid from the input from frontend.
	const { uid } = request.data;

	// Get the staff uid fro  the input from frontend
	const staffUid = request.auth.uid

	if (!uid) { // if uid is empty
		throw new HttpsError("invalid-argument", "Customer UID is required.");
	}

	try {
		// 1. Define the references, as an address. Object-mapping for NoSQL, but this reference system is for firestore specifically. The reference is just an address
		const customerRef = admin.firestore().collection("customers").doc(uid); // need to keep the specific one customer info when calling this that is why uid needed
		const transactionRef = admin.firestore().collection("transactions").doc(); // every transaction when QR code scanned, it needs to be different transaction, that is why no ID passed

		// 2. Opening the transaction
		const result = await admin.firestore().runTransaction(async (t) => { // this is safer way ensuring read and write are atomic. also "t" stands for transaction
			// More simpler way exists (.update({ points: 1 })), but this is riskier, the point can be lost.
			
			// 1. Getting snapshot of the customer by customer reference from uid
			// Reference is just an address. You can see the attributes by the snapshot but it does not sync with the actual database.
			const customerDoc = await t.get(customerRef);
			let currentPoints = 0; // initializing these as defensive programming, preventing from the error
			let newPoints = 0; 

			// Snapshot existing check here. Distinguish between the new user and existing user
			if (!customerDoc.exists) { // if the customer doc does not exist = new user
				// --- New user scenario --- instead of throwing an error, create (t.set) the documents
				
				// Define the current and new points
				currentPoints = 0; // this was already declared
				newPoints = currentPoints + 1 // no const needed here so that it prevents from shadowing. It was creating local variables inside of the if block
				
				// Create the customer profile
				t.set(customerRef, {
					points: newPoints, // 0+1
					createdAt: FieldValue.serverTimestamp(), // changed this way to align with import { FieldValue } added newly, not only here but other same spot
					lastAddedAt: FieldValue.serverTimestamp(),
					status: "active",
					isAnonymous: true // identifying PWA guest users
				});

				// Create the transaction record
				t.set(transactionRef, {
					customerId: uid, // linking this to the new user.
					staffId: staffUid, // || "emulator-test-user" Commenting out this part as this is for debugging 
					timestamp: FieldValue.serverTimestamp(),
					pointsAdded: 1,
					type: "new user scan registration" // labeling this as first transaction
				});
		
			} else {
				// --- Existing user scenario --- Check the rate limit and put other process as well 
				
				// 1. Define data
				const data = customerDoc.data(); // what kind of data is this? -> Extracting all data, you can specify by putting dot after
				const MIN_INTERVAL_MS = 60000; // 1 minutes = 60000 milliseconds MS
				const now = new Date(); // Getting current time 
				
				// 1.5 Rate limit check process here
				const lastAddedAt = data?.lastAddedAt?.toDate() || new Date(0); // Default to 1970, in case the existing user dataset is missing or undefined this field.

				if (now.getTime() - lastAddedAt.getTime() < MIN_INTERVAL_MS) { // If the substraction from last added time minus current time equals 1 min
					throw new HttpsError("resource-exhausted", "Rate limit, too fast");
				}

				// 2. Define the current point and new newPoints, math part here
				currentPoints = data?.points || 0;  // checks the value left side first and then if it is empty (null, 0. false etc), use right side value.	
				newPoints = currentPoints + 1;

				// 3. Updating customer profile
				t.update(customerRef, {
					points:newPoints, 
					lastAddedAt:FieldValue.serverTimestamp() // This stores current time, updating the lastAddedAt time.
				 });

				// 4. Creating transaction record
				t.set(transactionRef, {
					customerId: uid,
					staffId: staffUid, // current code does not have staffId field.-> Since this is NoSQL, the field will be created automatically 
					timestamp: FieldValue.serverTimestamp(),
					pointsAdded: 1,
					type: "existing user scan"
				});

			}	
			return { // This is sending (returning) to const result. Without this, "result" will be undefined. The frontend cannot see this data
       			newPoints: newPoints, 
        		transactionId: transactionRef.id 
    		};		
		});
	
		// Returning data from cloud function to the user's phone, this is final API response
		return {
			ok: true,
			newPoints: result.newPoints,
			txId: result.transactionId 
		};

	} catch (error:any) {
		// Logging error message for Google Cloud Logs Explorer
		logger.error("addPoint transaction failed:", error);
		
		// If it's an error we already defined (like "not-found"), pass it through
    	if (error instanceof HttpsError) throw error; // shorter way of if statement. Not to overwrite the raise error code in try
    	// checking if the error is same class of HttpsError, this is for 1. intentional errors that has already reasons
    
   		// Otherwise, throw a generic internal error, this is for 2. accidental errors
    	throw new HttpsError("internal", "Failed to update points.");
	}

});
