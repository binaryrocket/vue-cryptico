// Depends on jsbn.js and rng.js
// Version 1.1: support utf-8 encoding in pkcs1pad2
// convert a (hex) string to a bignum object

import { BigInteger } from './jsbn';
import { SecureRandom, SeededRandom } from './random';
import { sha1, sha256 } from './hash';

function parseBigInt(str, r) {
    return new BigInteger(str, r);
}

// eslint-disable-next-line no-unused-vars
function linebrk(s, n) {
    let ret = "";
    let i = 0;
    while (i + n < s.length) {
        ret += s.substring(i, i + n) + "\n";
        i += n;
    }
    return ret + s.substring(i, s.length);
}

// eslint-disable-next-line no-unused-vars
function byte2Hex(b) {
    if (b < 0x10) return "0" + b.toString(16);
    else return b.toString(16);
}

// PKCS#1 (type 2, random) pad input string s to n bytes, and return a bigint


function pkcs1pad2(s, n) {
    if (n < s.length + 11) { // TODO: fix for utf-8
        // alert("Message too long for RSA (n=" + n + ", l=" + s.length + ")");
        // return null;
        throw "Message too long for RSA (n=" + n + ", l=" + s.length + ")";
    }
    const ba = [];
    let i = s.length - 1;
    while (i >= 0 && n > 0) {
        const c = s.charCodeAt(i--);
        if (c < 128) { // encode using utf-8
            ba[--n] = c;
        }
        else if ((c > 127) && (c < 2048)) {
            ba[--n] = (c & 63) | 128;
            ba[--n] = (c >> 6) | 192;
        }
        else {
            ba[--n] = (c & 63) | 128;
            ba[--n] = ((c >> 6) & 63) | 128;
            ba[--n] = (c >> 12) | 224;
        }
    }
    ba[--n] = 0;
    const rng = new SecureRandom();
    const x = [];
    while (n > 2) { // random non-zero pad
        x[0] = 0;
        while (x[0] === 0) rng.nextBytes(x);
        ba[--n] = x[0];
    }
    ba[--n] = 2;
    ba[--n] = 0;
    return new BigInteger(ba);
}

// "empty" RSA key constructor


export function RSAKey() {
    this.n = null;
    this.e = 0;
    this.d = null;
    this.p = null;
    this.q = null;
    this.dmp1 = null;
    this.dmq1 = null;
    this.coeff = null;
}
// Set the public key fields N and e from hex strings


function RSASetPublic(N, E) {
    if (N != null && E != null && N.length > 0 && E.length > 0) {
        this.n = parseBigInt(N, 16);
        this.e = parseInt(E, 16);
    }
    else alert("Invalid RSA public key");
}

// Perform raw public operation on "x": return x^e (mod n)


function RSADoPublic(x) {
    return x.modPowInt(this.e, this.n);
}

// Return the PKCS#1 RSA encryption of "text" as an even-length hex string


function RSAEncrypt(text) {
    const m = pkcs1pad2(text, (this.n.bitLength() + 7) >> 3);
    if (m == null) return null;
    const c = this.doPublic(m);
    if (c == null) return null;
    const h = c.toString(16);
    if ((h.length & 1) === 0) return h;
    else return "0" + h;
}

// Return the PKCS#1 RSA encryption of "text" as a Base64-encoded string
// function RSAEncryptB64(text) {
//  var h = this.encrypt(text);
//  if(h) return hex2b64(h); else return null;
// }
// protected
RSAKey.prototype.doPublic = RSADoPublic;

// public
RSAKey.prototype.setPublic = RSASetPublic;
RSAKey.prototype.encrypt = RSAEncrypt;

// Version 1.1: support utf-8 decoding in pkcs1unpad2
// Undo PKCS#1 (type 2, random) padding and, if valid, return the plaintext

function pkcs1unpad2(d, n) {
    const b = d.toByteArray();
    let i = 0;
    while (i < b.length && b[i] === 0) ++i;
    if (b.length - i !== n - 1 || b[i] !== 2) return null;
    ++i;
    while (b[i] !== 0)
        if (++i >= b.length) return null;
    let ret = "";
    while (++i < b.length) {
        const c = b[i] & 255;
        if (c < 128) { // utf-8 decode
            ret += String.fromCharCode(c);
        }
        else if ((c > 191) && (c < 224)) {
            ret += String.fromCharCode(((c & 31) << 6) | (b[i + 1] & 63));
            ++i;
        }
        else {
            ret += String.fromCharCode(((c & 15) << 12) | ((b[i + 1] & 63) << 6) | (b[i + 2] & 63));
            i += 2;
        }
    }
    return ret;
}

// Set the private key fields N, e, and d from hex strings
function RSASetPrivate(N, E, D) {
    if (N != null && E != null && N.length > 0 && E.length > 0) {
        this.n = parseBigInt(N, 16);
        this.e = parseInt(E, 16);
        this.d = parseBigInt(D, 16);
    }
    else alert("Invalid RSA private key");
}

// Set the private key fields N, e, d and CRT params from hex strings
function RSASetPrivateEx(N, E, D, P, Q, DP, DQ, C) {
    if (N != null && E != null && N.length > 0 && E.length > 0) {
        this.n = parseBigInt(N, 16);
        this.e = parseInt(E, 16);
        this.d = parseBigInt(D, 16);
        this.p = parseBigInt(P, 16);
        this.q = parseBigInt(Q, 16);
        this.dmp1 = parseBigInt(DP, 16);
        this.dmq1 = parseBigInt(DQ, 16);
        this.coeff = parseBigInt(C, 16);
    }
    else alert("Invalid RSA private key");
}

// Generate a new random private key B bits long, using public expt E
function RSAGenerate(B, E) {
    const rng = new SeededRandom();
    const qs = B >> 1;
    this.e = parseInt(E, 16);
    const ee = new BigInteger(E, 16);
    for (; ;) {
        for (; ;) {
            this.p = new BigInteger(B - qs, 1, rng);
            if (this.p.subtract(BigInteger.ONE).gcd(ee).compareTo(BigInteger.ONE) === 0 && this.p.isProbablePrime(10)) break;
        }
        for (; ;) {
            this.q = new BigInteger(qs, 1, rng);
            if (this.q.subtract(BigInteger.ONE).gcd(ee).compareTo(BigInteger.ONE) === 0 && this.q.isProbablePrime(10)) break;
        }
        if (this.p.compareTo(this.q) <= 0) {
            const t = this.p;
            this.p = this.q;
            this.q = t;
        }
        const p1 = this.p.subtract(BigInteger.ONE);
        const q1 = this.q.subtract(BigInteger.ONE);
        const phi = p1.multiply(q1);
        if (phi.gcd(ee).compareTo(BigInteger.ONE) === 0) {
            this.n = this.p.multiply(this.q);
            this.d = ee.modInverse(phi);
            this.dmp1 = this.d.mod(p1);
            this.dmq1 = this.d.mod(q1);
            this.coeff = this.q.modInverse(this.p);
            break;
        }
    }
}

// Perform raw private operation on "x": return x^d (mod n)
function RSADoPrivate(x) {
    if (this.p == null || this.q == null) return x.modPow(this.d, this.n);
    // TODO: re-calculate any missing CRT params
    let xp = x.mod(this.p).modPow(this.dmp1, this.p);
    const xq = x.mod(this.q).modPow(this.dmq1, this.q);
    while (xp.compareTo(xq) < 0)
        xp = xp.add(this.p);
    return xp.subtract(xq).multiply(this.coeff).mod(this.p).multiply(this.q).add(xq);
}

// Return the PKCS#1 RSA decryption of "ctext".
// "ctext" is an even-length hex string and the output is a plain string.
function RSADecrypt(ctext) {
    const c = parseBigInt(ctext, 16);
    const m = this.doPrivate(c);
    if (m == null) return null;
    return pkcs1unpad2(m, (this.n.bitLength() + 7) >> 3);
}

// protected
RSAKey.prototype.doPrivate = RSADoPrivate;

// public
RSAKey.prototype.setPrivate = RSASetPrivate;
RSAKey.prototype.setPrivateEx = RSASetPrivateEx;
RSAKey.prototype.generate = RSAGenerate;
RSAKey.prototype.decrypt = RSADecrypt;


//
// rsa-sign.js - adding signing functions to RSAKey class.
//
//
// version: 1.0 (2010-Jun-03)
//
// Copyright (c) 2010 Kenji Urushima (kenji.urushima@gmail.com)
//
// This software is licensed under the terms of the MIT License.
// http://www.opensource.org/licenses/mit-license.php
//
// The above copyright and license notice shall be 
// included in all copies or substantial portions of the Software.
//
// Depends on:
//   function sha1.hex(s) of sha1.js
//   jsbn.js
//   jsbn2.js
//   rsa.js
//   rsa2.js
//
// keysize / pmstrlen
//  512 /  128
// 1024 /  256
// 2048 /  512
// 4096 / 1024
// As for _RSASGIN_DIHEAD values for each hash algorithm, see PKCS#1 v2.1 spec (p38).
const _RSASIGN_DIHEAD = [];
_RSASIGN_DIHEAD.sha1 = "3021300906052b0e03021a05000414";
_RSASIGN_DIHEAD.sha256 = "3031300d060960864801650304020105000420";
// _RSASIGN_DIHEAD['md2'] = "3020300c06082a864886f70d020205000410";
// _RSASIGN_DIHEAD['md5'] = "3020300c06082a864886f70d020505000410";
// _RSASIGN_DIHEAD['sha384'] = "3041300d060960864801650304020205000430";
// _RSASIGN_DIHEAD['sha512'] = "3051300d060960864801650304020305000440";
const _RSASIGN_HASHHEXFUNC = [];
_RSASIGN_HASHHEXFUNC.sha1 = sha1.hex;
_RSASIGN_HASHHEXFUNC.sha256 = sha256.hex;

// ========================================================================
// Signature Generation
// ========================================================================

function _rsasign_getHexPaddedDigestInfoForString(s, keySize, hashAlg) {
    const pmStrLen = keySize / 4;
    const hashFunc = _RSASIGN_HASHHEXFUNC[hashAlg];
    const sHashHex = hashFunc(s);

    const sHead = "0001";
    const sTail = "00" + _RSASIGN_DIHEAD[hashAlg] + sHashHex;
    let sMid = "";
    const fLen = pmStrLen - sHead.length - sTail.length;
    for (let i = 0; i < fLen; i += 2) {
        sMid += "ff";
    }
    const sPaddedMessageHex = sHead + sMid + sTail;
    return sPaddedMessageHex;
}

function _rsasign_signString(s, hashAlg) {
    const hPM = _rsasign_getHexPaddedDigestInfoForString(s, this.n.bitLength(), hashAlg);
    const biPaddedMessage = parseBigInt(hPM, 16);
    const biSign = this.doPrivate(biPaddedMessage);
    const hexSign = biSign.toString(16);
    return hexSign;
}

function _rsasign_signStringWithSHA1(s) {
    const hPM = _rsasign_getHexPaddedDigestInfoForString(s, this.n.bitLength(), 'sha1');
    const biPaddedMessage = parseBigInt(hPM, 16);
    const biSign = this.doPrivate(biPaddedMessage);
    const hexSign = biSign.toString(16);
    return hexSign;
}

function _rsasign_signStringWithSHA256(s) {
    const hPM = _rsasign_getHexPaddedDigestInfoForString(s, this.n.bitLength(), 'sha256');
    const biPaddedMessage = parseBigInt(hPM, 16);
    const biSign = this.doPrivate(biPaddedMessage);
    const hexSign = biSign.toString(16);
    return hexSign;
}

// ========================================================================
// Signature Verification
// ========================================================================

function _rsasign_getDecryptSignatureBI(biSig, hN, hE) {
    const rsa = new RSAKey();
    rsa.setPublic(hN, hE);
    const biDecryptedSig = rsa.doPublic(biSig);
    return biDecryptedSig;
}

function _rsasign_getHexDigestInfoFromSig(biSig, hN, hE) {
    const biDecryptedSig = _rsasign_getDecryptSignatureBI(biSig, hN, hE);
    const hDigestInfo = biDecryptedSig.toString(16).replace(/^1f+00/, '');
    return hDigestInfo;
}

function _rsasign_getAlgNameAndHashFromHexDisgestInfo(hDigestInfo) {
    for (const algName in _RSASIGN_DIHEAD) {
        const head = _RSASIGN_DIHEAD[algName];
        const len = head.length;
        if (hDigestInfo.substring(0, len) === head) {
            const a = [algName, hDigestInfo.substring(len)];
            return a;
        }
    }
    return [];
}

function _rsasign_verifySignatureWithArgs(sMsg, biSig, hN, hE) {
    const hDigestInfo = _rsasign_getHexDigestInfoFromSig(biSig, hN, hE);
    const digestInfoAry = _rsasign_getAlgNameAndHashFromHexDisgestInfo(hDigestInfo);
    if (digestInfoAry.length === 0) return false;
    const algName = digestInfoAry[0];
    const diHashValue = digestInfoAry[1];
    const ff = _RSASIGN_HASHHEXFUNC[algName];
    const msgHashValue = ff(sMsg);
    return (diHashValue === msgHashValue);
}

function _rsasign_verifyHexSignatureForMessage(hSig, sMsg) {
    const biSig = parseBigInt(hSig, 16);
    const result = _rsasign_verifySignatureWithArgs(sMsg, biSig, this.n.toString(16), this.e.toString(16));
    return result;
}

function _rsasign_verifyString(sMsg, hSig) {
    hSig = hSig.replace(/[ \n]+/g, "");
    const biSig = parseBigInt(hSig, 16);
    const biDecryptedSig = this.doPublic(biSig);
    const hDigestInfo = biDecryptedSig.toString(16).replace(/^1f+00/, '');
    const digestInfoAry = _rsasign_getAlgNameAndHashFromHexDisgestInfo(hDigestInfo);

    if (digestInfoAry.length === 0) return false;
    const algName = digestInfoAry[0];
    const diHashValue = digestInfoAry[1];
    const ff = _RSASIGN_HASHHEXFUNC[algName];
    const msgHashValue = ff(sMsg);
    return (diHashValue === msgHashValue);
}

RSAKey.prototype.signString = _rsasign_signString;
RSAKey.prototype.signStringWithSHA1 = _rsasign_signStringWithSHA1;
RSAKey.prototype.signStringWithSHA256 = _rsasign_signStringWithSHA256;

RSAKey.prototype.verifyString = _rsasign_verifyString;
RSAKey.prototype.verifyHexSignatureForMessage = _rsasign_verifyHexSignatureForMessage;



























