# Change log

## 0.3.3

### Changes

- Bump dependencies to latest (#47)

### Fixes

- `defaultWriteSizeLimit` with new config node (#49)

### Improves

- The logic around `defaultWriteSizeLimit` (#51)

## 0.3.2

### Changes

- Change the method from POST to PUT for `rtdb-settings` (#43)
- Bump dependencies to latest (#47)

### Fixes

- Fix and improve the logic of destroying/restoring unused dbs (#46)

### Improves

- Improve error handling when logging in via email (#41)
- Mask the email address printed in console (#42)
- Allow to set `defaultWriteSizeLimit` as long as the runtime-side node allows it (#44)

## 0.3.1

### Changes

- Add Config Node Checker Plugin utility functions (#36)
- Bump dependencies to latest

## 0.3.0

### Breaking Changes

- Set required version of Node.js to >=20

### Changes

- Bump dependencies to latest.

## 0.2.7

### Fixes

- Prevent a request forgery attack to RTDB settings (#30)
- RTDB URL pattern (#31)

## 0.2.6

### Changes

- Bump dependencies to latest. See #26
- Update the versioning (#27)

## 0.2.5

### Changes

- Bump dependencies to latest

## 0.2.4

### Enhances

- Support for `addDoc` to create a doc with auto-generated id (#23)

### Fixes

- `got` dependency missing - replaced by `axios` (#22)

## 0.2.3

### Improvements

- Using RTDB status must validate database URL
- Silent error when getting RTDB Setting

## 0.2.2

### Changes

- Allow `statusListener` to accept node instance instead of id (#19)
- Bump dependencies to latest

### Enhances

- Allow UI to set the RTDB `defaultWriteSizeLimit` setting (#18)

## 0.2.1

### Changes

- Add some guards to prevent unexpected UI error
- Bump dependencies to latest

### Fixes

- Do not call signout if app initialization failed (#15)
- Fix bad Query object returned by applyQueryConstraints (#16)

### Improvements

- Handle drag and drop of a JSON file with missing properties (#14)

## 0.2.0

### Breaking Changes

- Set required version of Node.js to >=18
- Set required version of Node-RED to >=3

### Changes

- Only don't wait signout for Firestore and add a safety delay (#12)
- Bump dependencies to latest

## 0.1.5

### Changes

- Bump dependencies to latest

## 0.1.4

### Changes

- Bump dependencies to latest
  - Removed an unnecessary `console.log` statement

## 0.1.3

### Changes

- Remove the deprecated `fetchSignInMethodsForEmail` function (#11)

### Fixes

- Missing call to `done` in the catch while closing the node

## 0.1.2

### Fixes

- Fix Promise resolution when closing the Config Node (#10)

## 0.1.1

### Changes

- Bump dependencies to latest

### Fixes

- Version property setted on function instead of node

### Improvements

- Allow use of `orderBy` and `where` Query Constraints on multiple fields (#9)

## 0.1.0

### Changes

- Allow Firestore nodes to use RTDB connection status (#7)
- Bump dependencies to latest

### New Features

- Add `get`, `modify` and `subscribe` methods to Firestore (#6)

## 0.0.1

Initial version
