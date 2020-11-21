require('dotenv').config({ silent: true });

const jwksClient = require('jwks-rsa');
const jwt = require('jsonwebtoken');
const util = require('util');

const env = process.env.NODE_ENV || 'development'
const config = require('./knexfile.js')[env];
const knex = require('knex')(config)

const getPolicyDocument = (effect, resource) => {
    const policyDocument = {
        Version: '2012-10-17', // default version
        Statement: [{
            Action: 'execute-api:Invoke', // default action
            Effect: effect,
            Resource: resource,
        }]
    };
    return policyDocument;
}

async function getUserID (auth0Id) {
    if (auth0Id.includes('|')) {
        auth0Id = auth0Id.split('|');
        auth0Id = auth0Id[1];
      }
      // Find the user ID
      console.log(`getting user ${auth0Id}`)
      const user = await knex('automatafi.user').where({
          auth0_id: auth0Id,
        }).select('id');
    console.log(`returning ${user[0]} .id`)
    if(user.length > 0) {
        return user[0].id
    }
}


// extract and return the Bearer Token from the Lambda event parameters
const getToken = (params) => {
    if (!params.type || params.type !== 'TOKEN') {
        throw new Error('Expected "event.type" parameter to have value "TOKEN"');
    }

    const tokenString = params.authorizationToken;
    if (!tokenString) {
        throw new Error('Expected "event.authorizationToken" parameter to be set');
    }

    const match = tokenString.match(/^Bearer (.*)$/);
    if (!match || match.length < 2) {
        throw new Error(`Invalid Authorization token - ${tokenString} does not match "Bearer .*"`);
    }
    return match[1];
}

const jwtOptions = {
    audience: process.env.AUDIENCE,
    issuer: process.env.TOKEN_ISSUER
};

module.exports.authenticate = (params) => {
    console.log(params);
    const token = getToken(params);
    console.log(`got token ${token}`)
    const decoded = jwt.decode(token, { complete: true });
    console.log(decoded)
    if (!decoded || !decoded.header || !decoded.header.kid) {
        throw new Error('invalid token');
    }
    const getSigningKey = util.promisify(client.getSigningKey);
    console.log(getSigningKey)
    return getSigningKey(decoded.header.kid)
        .then( (key) => {
            console.log('verifying')
            const signingKey = key.publicKey || key.rsaPublicKey;
            return jwt.verify(token, signingKey, jwtOptions);
        })
        .then(async (decoded)=> {
            const userId = await getUserID(decoded.sub)
            return {...decoded, userId: userId}
        })
        .then( (decoded) => {
            console.log({
                principalId: decoded.sub,
                policyDocument: getPolicyDocument('Allow', params.methodArn),
                context: { scope: decoded.scope, userId: decoded.userId }
            })
            return {
            principalId: decoded.sub,
            policyDocument: getPolicyDocument('Allow', params.methodArn),
            context: { scope: decoded.scope, userId: decoded.userId }
        }});

         
}

 const client = jwksClient({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10, // Default value
        jwksUri: process.env.JWKS_URI
  });
