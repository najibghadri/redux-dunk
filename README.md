

<p align="center"><img width="320" src="https://user-images.githubusercontent.com/11639734/108255304-61ff8e00-715c-11eb-8dca-30544a097424.png"></p>

---

🏀 Effect management in redux, inspired by loop ➿ 

Shape of an Effect:

`({ dispatch, getState }) => any`

Shape of an EffectCreator:

`(...extraParams) => ({ dispatch, getState }) => any`

Usage examples in reducer:

return dunk(newState) - does nothing interesting
return dunk(newState, Effects.doTheThing) - paramterless Effect
return dunk(newState, Effects.reorderTopic(action.payload.topicId, action.payload.to)); - effect created with parameters

## How effects are run with the redux store?

 1. There is a dispatch(action) somewhere
 2. action goes to reducer 
 3. reducer creates new state, and calls dunk(newState, ...effects) which schedules effects in the queue to run later.
 4. reducer finishes and dunk as a next middleware gets called
 5. dunk schedules the effects in the queue to run in the end of this event-loop tick (with promises in the job queue)
 6. effects run and might dispatch actions for the next redux round, or read the state whenever.

- Effects are always scheduled after the reducer has finished.
- Effects run async (end of current event-loop tick)
- getState always returns the latest state in the store, not the one it was when the effect was scheduled (this is 👍 )
- avoid never-ending loops (action->reducer->effect->action->..) ⚠️ 

## Api Reference

Delay(ms, effect) - run effect after ms delay
Sequence(…effects) - run effects in order waiting for promise to resolve. if one fails the effect fails
Par(…effects) - same as dunk(state, …effects), starts running effects parallelly
Catch(effect, failEffect) try to run effect if it fails run the failEffect
NoOp() - effect that does nothing

## Testing
## Comparison with redux-loop

Every dunk is a loop but not every loop is a dunk:
Here is how you can create Loop in 10 lines with Dunk:

```
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
```

Dunk builds on the same architecture as loop, which is the one described above.

### Commonalities 🤝 

- Same architecture **action -> reducer -> effect** separation (effect = command in loop)
- Same flow: reducer changes state first, *then* dunked Effect start running (however an Effect can be composed from Effects)
- Typed Effects/Commands
- Redux store can be used the same way

### Pros cons with loop 🏀 
 - Effects are composable, it's a monad basically
 - Effect api to your needs: any extra params and `getState`, `dispatch`
 - You are free in your effects, no babysitting success/fail action restrictions, dispatch as many actions as you want
 - Understandable effects: explicit dispatch calls, no mind  wrapped args, no spaghetti thinking
 - Composable effect creator helpers out of the box: `Delay`, `Sequence`, `Par`, `Catch` and more coming( `Cancelable`, `TakeOne`, `LoopCommand`, `Retry`, `Poll`, `Race`) all of these return an Effect.
 - It's just a middleware. While loop installs as an enhancer, we found there is no need for that. 
 - Calling `loop` returns a modified object that contains the effects, but we found there is no need for that. `dunk` simply returns the state object it got, and queues the effects in the internal queue.
 - Written in Typescript

### Cons over loop ➿ 
- Effect type doesn't tell which actions will be dispatched if any (because you write whatever you want in the effect body)
- More freedom in effects might lead to bad code? Loop has a strict (and limited) view on effects which might or might not work out for you.

