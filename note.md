we can not store images in sql columns what we do we encode the image in base64 string and shove the whole image in to a text column in sql. base 64 is 
just away to encode binary data as text 



bun file i/o
reading and wrting files 
*bun.file
*file.delete
*bun.write





node path  provides utilites with working with file and directory paths


Media types (MIME types)
A media type (formerly known as a Multipurpose Internet Mail Extensions or MIME type) indicates the nature and format of a document, file, or assortment of bytes. MIME types are defined and standardized in IETF's RFC 6838.

FormData
The FormData interface provides a way to construct a set of key/value pairs representing form fields and their values, which can be sent using the fetch(), XMLHttpRequest.send() or navigator.sendBeacon() methods. It uses the same format a form would use if the encoding type were set to "multipart/form-data".
Instance methods
FormData.append()
Appends a new value onto an existing key inside a FormData object, or adds the key if it does not already exist.

FormData.delete()
Deletes a key/value pair from a FormData object.

FormData.entries()
Returns an iterator that iterates through all key/value pairs contained in the FormData.

FormData.get()
Returns the first value associated with a given key from within a FormData object.

FormData.getAll()
Returns an array of all the values associated with a given key from within a FormData.

FormData.has()
Returns whether a FormData object contains a certain key.

FormData.keys()
Returns an iterator iterates through all keys of the key/value pairs contained in the FormData.

FormData.set()
Sets a new value for an existing key inside a FormData object, or adds the key/value if it does not already exist.

FormData.values()
Returns an iterator that iterates through all values contained in the FormData.

✅ Explain why we use path.join() instead of string concatenation
Using path.join() instead of string concatenation is the recommended practice for working with file paths because it provides cross-platform compatibility, is less error-prone, and results in clearer, more readable code. 

path is prefered because difffirent operation sysmens use diffrent path seperators. 
path.jojn clealy indicates that you are workng with file paths, making code more understadable
readabolity and maintainablity 
Reduced Error Proneness: By abstracting away the complexities of path handling, path.join() minimizes the likelihood of common errors associated with manual string concatenation, such as missing or incorrect separators, leading to more robust and reliable applications.




✅ Explain what happens to the data from upload to disk to browser
✅ Debug a "file not found" error without help
✅ Add a new MIME type to the mapping without breaking anything
✅ Explain the difference between /upload/thumbnails/:id and /assets/:id

Token Bucket Algorithm