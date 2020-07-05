const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// auth trigger (new user signup)
exports.newUserSignUp = functions.auth.user().onCreate(user => {
    // for background triggers you must return a value/promise
    return admin.firestore().collection('users').doc(user.uid).set({
        email: user.email,
        upvotedOn: [],
    });
});

// auth trigger (user deleted)
exports.userDeleted = functions.auth.user().onDelete(user => {
    const doc = admin.firestore().collection('users').doc(user.uid);
    return doc.delete();
});

// http callable function (adding a request)
exports.addRequest = functions.https.onCall((data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'sem registo',
            'só os utilizadores autenticados podem criar um registo'
        );
    }
    if (data.text.length > 30) {
        throw new functions.https.HttpsError(
            'argumento invalido',
            'não pode ter mais de 30 caracteres o registo'
        );
    }
    return admin.firestore().collection('requests').add({
        text: data.text,
        upvotes: 0
    });
});

// // upvote callable function
exports.upvote = functions.https.onCall(async (data, context) => {
    // check auth state
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'sem autentificação',
            'só se pode votar com autentififação'
        );
    }
    // get refs for user doc & request doc
    const user = admin.firestore().collection('users').doc(context.auth.uid);
    const request = admin.firestore().collection('requests').doc(data.id);

    const doc = await user.get();
    // check thew user hasn't already upvoted
    if (doc.data().upvotedOn.includes(data.id)) {
        throw new functions.https.HttpsError(
            'sem condições',
            'só pode votar uma vez por barco'
        );
    }

    // update the array in user document
    await user.update({
        upvotedOn: [...doc.data().upvotedOn, data.id]
    });

    // update the votes on the request
    return request.update({
        upvotes: admin.firestore.FieldValue.increment(1)
    });

});


// firestore trigger for tracking activity
exports.logActivities = functions.firestore.document('/{collection}/{id}')
    .onCreate((snap, context) => {
        console.log(snap.data());

        const activities = admin.firestore().collection('activities');
        const collection = context.params.collection;

        if (collection === 'requests') {
            return activities.add({ text: 'um novo barco foi criado' });
        }
        if (collection === 'users') {
            return activities.add({ text: 'um novo utilizador foi criado' });
        }

        return null;
    });
