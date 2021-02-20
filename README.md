

<img width="350" src="https://user-images.githubusercontent.com/11639734/108255304-61ff8e00-715c-11eb-8dca-30544a097424.png">


🏀 Effect management in redux, inspired by loop ➿ 

- [API](#api)  
- [Examples](#examples)  
- [How it works](#how-effects-are-run-with-the-redux-store)  
- [Comparison with redux-loop ➿](#comparison-with-redux-loop-)  

Shape of an Effect:

```typescript 
async({ dispatch, getState }) => any
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
- ` EffectCreator(effectCreator)` - easily create an effect creator, input shape: `(...extraParams) => async ({ dispatch, getState }) => any`

Use `Effect` to create your effect without extra parameters, use `EffectCreator` when the effect needs extra parameters. 

When you create effects with these two helpers you get Effects with Monadic EffectApi:
#### Effect Api
- then
- fmap
- catch
- fold
- sleep

#### Effect composers
Each of these return an Effect so you can compose them.
- Delay(ms, effect) - run effect after ms delay
- Sequence(…effects) - run effects in order waiting for promise to resolve. if one fails the effect fails
- Par(…effects) - same as dunk(state, …effects), starts running effects parallelly
- Catch(effect, failEffect) try to run effect if it fails run the failEffect
- Do() - i.e No Op, effect that does nothing, you can start a chain description with this, use it wherever

## Examples
Example effects (from Zoom App codebase): 
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
```

Now dunk effects. Usage examples in a reducer (from ZoomApp codebase):
```typescript
return dunk(newState) - does nothing interesting
return dunk(newState, Effects.doTheThing) - paramterless Effect
return dunk(newState, Effects.reorderTopic(topicId, targetIdx)); - effect created with parameters

case actions.startSetup.actionType: {
    const { token, userId } = action.payload;

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
 - compose effects to describe your flow in a testable way
````
With dunk you can express business logic by composing effects together. You don't have to bloat your code with unnecessary effect -> action -> reducer -> effect loops, since you can directly chain or sequence effects using composer or effect API (see below).

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

Dunk builds on the same architecture as loop, which is the one described above.
The high level concepts of loop apply to dunk: https://redux-loop.js.org/

### Commonalities 🤝 

- Same architecture **action -> reducer -> effect** separation (effect = command in loop)
- Same flow: reducer changes state first, *then* dunked Effect start running (however an Effect can be composed from Effects)
- Typed Effects/Commands
- Redux store can be used the same way

### Pros over loop 🏀 
 - Effects are composable and chainable (Monadic too ✊)
 - Effect api to your needs: any extra params and `getState`, `dispatch`
 - You are free in your effects, no babysitting success/fail action restrictions, dispatch as many actions as you want
 - Understandable effects: explicit dispatch calls, no mind wrapped args and implicit calls of dispatch
 - Composable effect creator helpers out of the box: `Delay`, `Sequence`, `Par`, `Catch` and more coming, all of these return an Effect.
 - It's just a middleware. While loop installs as an enhancer, we found there is no need for that. 
 - Calling `loop` returns a modified object that contains the effects, but we found there is no need for that. `dunk` simply returns the state object it got, and queues the effects in the internal queue.
 - Written in Typescript, smaller codebase

### Cons compared to loop ➿
- Battle-tested library
- A Dunk Effect's type doesn't tell which actions will be dispatched if any (because you write whatever you want in the effect body), however a loop command tells you about the next actions in it's type.
- More freedom in effects might lead to bad code? Loop has a strict view on effects which might work for you and might keep your codebase better structured if there are many developers working on it.


## Todos
 - Effect testers
 - More effect helpers (`Chain`, `Retry`, `Poll`, `Race`)
 - `Cancelable`, `TakeOne` and other action trigger based complex Effects. (like saga)
 - Implement Effect Api: `TestEffects.testEff1.sleep(100).then(TestEffects.testEff2).then(TestEffects.testEff3).catch(eff4)`
 - Use Effect interface type in all exported functions except Effect and EffectCreator.


## Questions
#### Why Effect is an interface not a class?

Creating an Effect with Effect(...) and EffectCreator(...) returns you an object with two interfaces implemented: Effect and EffectApi. 
There are a couple of reasons why Effect should be an interface.
1. An effect should be a function that can be called like effect(storeapi) but it can also have properties, like the EffectApi. This is because functions are objects too in JS, and we should take advantage of this.
2. Effects should be kept lightweight.
3. It's better for the user, better DX. The user should be able to dunk an effect function so long the shape is an Effect without the need call the Effect(...) function (that would return an instance of a class).
4. In my opinion using interfaces is better developing the library too. Interfaces are composable, and easy to follow, but using classes is a restriction imo (not just because we have to call `new`)
