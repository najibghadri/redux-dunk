

<img width="350" src="https://user-images.githubusercontent.com/11639734/108255304-61ff8e00-715c-11eb-8dca-30544a097424.png">


🏀 Effect middleware for redux, inspired by loop and thunk ➿ \
*Schedule async functions from reducers to run after reducers using dispatch-getstate store api.*

- [API](#api)  
- [Usage](#usage)
- [Examples](#examples)  
- [How it works](#how-effects-are-run-with-the-redux-store)  
- [Comparison with redux-loop ➿](#comparison-with-redux-loop-)  

Shape of an Effect:

```typescript 
async ({ dispatch, getState }) => any
```

Shape of an EffectCreator:

```typescript 
(...extraParams) => async ({ dispatch, getState }) => any
```

## API

#### dunk
- `dunk(nextState, ...effects)` - schedules given effects to run parallelly after reducer has finished, and returns the given state as it is.

#### Effect creators
- `Effect(effect)` - let's you easily create an effect, input shape: ` async ({ dispatch, getState }) => any`
- ` EffectCreator(effectCreator)` - easily create an effect creator, input shape: <br/>`(...extraParams) => async ({ dispatch, getState }) => any`

Use `Effect` to create your effect without extra parameters, use `EffectCreator` when the effect needs extra parameters. 

When you create effects with these two helpers you get Effects with (monadic) EffectApi:
#### Effect Api
- `.andThen(effect)` -- chain effects that run after each other if they succeed
- `.catch(effect)` -- if the effect fails run this effect 
- `.fmap(res => effect) or .fmap(effectCreator)` -- not implemented as we found it can lead to bad practices. Dispatch actions and dunk the next effect in those instead
- `fold` -- not yet implemented - based on requests
- `sleep` -- not yet implemented - based on requests

#### Effect composers
Each of these return an Effect so you can compose them.
- `Delay(ms, effect)` - run effect after ms delay
- `Sequence(…effects)` - run effects in order waiting for promise to resolve. if one fails the effect fails
- `Par(…effects)` - same as dunk(state, …effects), starts running effects parallelly
- `Catch(effect, failEffect)` try to run effect if it fails run the failEffect
- `Do()` - i.e No Op, effect that does nothing, you can start a chain description with this, use it wherever

## Usage

#### 1. Create your store with dunkMiddleware
```typescript
    return createStore(
        getReducer(props),
        getInitialState(props),
        composeEnhancers(applyMiddleware(dunkMiddleware)),
    );
```
#### 2. Create you effects in your effects file
To use the Effect creator/composer functions you need to import the `EffectCreators` function, then call it with your State type to get typed helpers.
```typescript
const { Effect, EffectCreator } = EffectCreators<State>();
```

#### 3. Use you effects in your reducers
Import your effects, and dunk them. You can import composers in your reducer if you need to:

```typescript
const { Sequence, Delay, Catch } = EffectCreators<State>();
```

## Examples
Example effects (some from Zoom App codebase): 
```typescript
const setUpZoomSdk = Effect( async ({ dispatch }) => {
    const configResponse = await zoomSdk.config({});
    dispatch(actions.setRunningContext(configResponse.runningContext));
});

const setUpPusher = EffectCreator((userId: UserId) => async ({ dispatch }) => {
    const pvHandler: PVControllerHandler = {
        onSession: session => {
            dispatch(actions.updateSession(session));
        },
    };
    connectPusherPvController(userId, pvHandler);
});

const fetchUser = Effect( async ({ dispatch }) => {
    fetch('/user')
        .then(res => dispatch(actions.fetchUserSuccess(res))
        .catch(err => dispatch(actions.fetchUserFail(err))
});
```

Now dunk effects. Usage examples in a reducer (some from ZoomApp codebase):
```typescript
return dunk(newState) // does nothing interesting
return dunk(newState, Effects.doTheThing) // paramterless Effect
return dunk(newState, Effects.reorderTopic(topicId, targetIdx)); // effect created with parameters

case actions.startSetup.actionType: {
    const { token, userId } = action.payload;

     // compose effects to describe your flow in a testable way
    const effects = [
        Sequence(
            Effects.setUpZoomSdk, 
            Effects.authenticate(token), 
            Effects.setOrGetUserInfo(userId)
        ),
        Effects.setUpKeyboardListeners,
    ];
    return dunk(state, ...effects);
}; 

    // you can also chain effects with dot notation api:
    const effects = [
        Effects.setUpZoomSdk
            .then(Effects.authenticate(token))
            .then(Effects.setOrGetUserInfo(userId)),
        Effects.setUpKeyboardListeners,
    ];
````
With dunk you can express business logic by composing effects together.

## How effects are run with the redux store?

 1. There is a dispatch(action) somewhere
 2. action goes to reducer 
 3. reducer creates new state, and calls dunk(newState, ...effects) which schedules effects in the queue to run later.
 4. reducer finishes and dunk as a next middleware gets called
 5. dunk schedules the effects in the queue to run in the end of this event-loop tick (using promises, to the js job queue)
 6. effects run and might dispatch actions for the next redux round, or read the state whenever.

note

- Effect's can't (and shouldn't) be called from a reducer. They are run by dunk and each effect is provided the store api (dispatch and getState) upon running.
- Remember Effect if an async function, EffectCreator is a higher-order function that returns an Effect.
- Effects are always scheduled to run after the reducer round that scheduled them has finished.
- Effects are async functions
- Effects run deferred async (end of current event-loop tick)
- getState always returns the latest state in the store, not the one it was when the effect was scheduled (this is 👍 )
- So far we haven't found a valid use case for using getState in an effect. If the effect needs parameters they should be provided with the effect creator as extra params. It might be useful to getState when you have a long-running effect that needs to check the state at later times.
- avoid never-ending loops (action->reducer->effect->action->..) ⚠️ (same in loop)

## Comparison with redux-loop ➿

Every loop is a dunk but not every dunk is a loop:

Shape of a Loop Cmd:
```typescript 
  Cmd.run(apiFetch, {
     successActionCreator: resolveActionCreator,
     failActionCreator: rejectActionCreator,
     args: [action.payload.id]
  })
```
Here is how you can recreate the loop Cmd in 10 lines with Dunk:

```typescript 
  function LoopCmd(
      promise: (...params: Params) => Promise<ReturnType>,
      successActionCreator: ActionCreator,
      failedActionCreator: ActionCreator,
  ) {
      return EffectCreator((...params: Params) => storeApi => {
          return promise(...params)
              .then(res => storeApi.dispatch(successAction(...res)))
              .catch(res => storeApi.dispatch(failedAction(...res)));
      });
  }
  
  LoopCmd(apiFetch, successActionCreator, failActionCreator)
```
This is proof that you can use dunk instead of loop the same way (if you really want to...)

Dunk builds on the same architecture as loop, which is the one described above.
The high level concepts of loop apply to dunk: https://redux-loop.js.org/

### Commonalities 🤝 

- Same architecture **action -> reducer -> effect** separation (effect = command in loop)
- Helps you create small, atomic testable effects
- Same flow: reducer changes state first, *then* dunked Effect start running (however an Effect can be composed from Effects)
- Typed Effects/Commands
- Redux store can be used the same way

### Pros over loop 🏀 
 - Powerful Effect api to your needs: any extra params plus each effets gets the `getState`, `dispatch` store api functions.
 - Effects are composable and chainable (Monadic too ✊). 
 - You don't have to bloat your code with unnecessary effect -> action -> reducer -> effect loops. You can describe your complex effect logic in your reducers, by composing or chaining them using composers and the EffectApi dot notation functions.
 - You are free in your effects, no success/fail action restrictions, dispatch as many actions as you want
 - Understandable effects: explicit dispatch calls, no mind wrapped args and implicit calls of dispatch
 - Composable effect creator helpers out of the box: `Delay`, `Sequence`, `Par`, `Catch` and more coming, all of these return an Effect.
 - Dunk is written in Typescript
 - Small, simplistic library (so far)
 - While loop installs as an enhancer, we found there is no need for that. dunk is only a middleware. This simplifies the architecture of the library.

### Cons compared to loop ➿
- Battle-tested library
- A Dunk Effect's type doesn't tell which actions will be dispatched if any (because you write whatever you want in the effect body), however a loop command tells you about the next actions in it's type.
- More freedom in effects might lead to bad code? Loop has a strict view on effects which might work for you and might keep your codebase better structured if there are many developers working on it.


## Todos
 - Effect test helpers
 - More effect helpers (`Chain`, `Retry`, `Poll`, `Race`)
 - `Cancelable`, `TakeOne` and other action trigger based complex Effects. (like saga)
 - Dependency management for pure effects

## Questions/Discussions

#### Are effects impure - dependency injection

This is a questions of your architecture. If effects use global dependencies then they are. This is an issue to be take care of in loop as well. Using a global HTTP API module or storage module or anything from global scope makes your tests difficult to test. This might not be an issue for some, and could be circumvented by taking care of global dependencies for example with a function that creates effects with dependencies. 

#### About dunk as middleware
While loop installs as an enhancer, we found there is no need for that. dunk is only a middleware. Calling `loop` returns a modified object that contains the effects, however `dunk` simply returns the state object it got, and queues the effects in the internal queue. This is partly because dunk is a middleware, not an enhancer, which simplifies the architecture of the library.

#### Multi store setup

This is not supported yet. Generally it's not recommended to have multiple stores in one bundle (app) (https://redux.js.org/faq/store-setup#can-or-should-i-create-multiple-stores-can-i-import-my-store-directly-and-use-it-in-components-myself) but we can make support for this. It would require you to set up dunk middleware, dunk function and Effect creators together, and use those instances together consistently (with all redux parts: store, reducer, actions, dispatch).
This is necessary to separate the state of multiple dunk middlewares: the effect queues and any potential stateful Effects (such as the planned `Cancellable`).


#### Why Effect is an interface not a class?

Creating an Effect with Effect(...) and EffectCreator(...) returns you an object with two interfaces implemented: Effect and EffectApi. 
There are a couple of reasons why Effect should be an interface.
1. An effect should be a function that can be called like effect(storeapi) but it can also have properties, like the EffectApi. This is because functions are objects too in JS, and we should take advantage of this.
2. Effects should be kept lightweight.
3. It's better for the user, better DX. The user should be able to dunk an effect function so long the shape is an Effect without the need call the Effect(...) function (that would return an instance of a class).
4. In my opinion using interfaces is better developing the library too. Interfaces are composable, and easy to follow, but using classes is a restriction imo (not just because we have to call `new`)


