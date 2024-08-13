// import { render, h } from "https://esm.sh/preact@10.13.2";
// import { useState, useEffect, useLayoutEffect, useRef } from "https://esm.sh/preact@10.13.2/hooks";
import { useEffect, useRef, useState,useLayoutEffect } from "react";
import './index.css'

import KeenASR from "./keenasr-web.js";
import { calculateAlignmentStats, highlightAlignment, highlightNextWord } from './alignmentHelpers.js'
import { AlertOutline } from './icons/AlertOutline.js'
import { ChevronDown } from './icons/ChevronDown.js'
import { Microphone } from './icons/Microphone.js'
import { DoubleCheck } from './icons/DoubleCheck.js'
import { Speedometer } from './icons/Speedometer.js'

// const html = htm.bind(h);

const text = "Once upon a time there was an old mother pig who had three little pigs and not enough food to feed them. So when they were old enough, she sent them out into the world to seek their fortunes. The first little pig was very lazy."
const transformedRefText = text.replace(/[^a-zA-Z0-9\s]/g, "").toUpperCase();

const bundleName = "keenAK1mPron4-nnet3chain-en-us";
const decodingGraphName = `dg-oral-reading-demo-${KeenASR.getVersionHash()}`;
const insertToken = "<eps>";

const SDKSetupStates = ["Preparing SDK", "Getting ASR Bundle", "Initializing SDK", "Finalizing"]

const filterUniqueAudioInputs = (audioInputs) => {
  const encounteredGroupIds = [];
  return audioInputs.filter(audioInput => {
    if (!encounteredGroupIds.includes(audioInput.groupId)) {
      encounteredGroupIds.push(audioInput.groupId);
      return true;
    }
    return false;
  });
}

 const App = () => {
  const [isStartBtnDisabled, setIsStartBtnDisabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isSDKLoading, setIsSDKLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [SDKSetupState, setSDKSetupState] = useState(0);
  const [isDebugInfoShown, setIsDebugInfoShown] = useState(false);
  const [partialResult, setPartialResult] = useState("");
  const [finalResult, setFinalResult] = useState("");
  const [availableAudioInputs, setAvailableAudioInputs] = useState([]);
  const [audioInputDeviceId, setAudioInputDeviceId] = useState("");
  const [durationSec, setDurationSec] = useState(null);
  const [alignmentStats, setAlignmentStats] = useState(null)
  const [wordsReadCorrectlyPct, setWordsReadCorrectlyPct] = useState(null);
  const [rateOfSpeech, setRateOfSpeech] = useState(null);
  const [audioURL, setAudioURL] = useState("");

  const [countdownMin, setCountdownMin] = useState(15);
  const countdownIntervalIdRef = useRef();

  const [shouldHighlightNextWord, setShouldHighlightNextWord] = useState(false);
  const shouldHighlightNextWordRef = useRef(shouldHighlightNextWord);

  const textRef = useRef();
  const audioRef = useRef();

  useEffect(() => {
    const setupSDK = async () => {
      try {
        if (!KeenASR.isBrowserSupported()) throw new Error("KeenASR Web SDK does not support this browser");
        
        const audioInputs = await KeenASR.getAvailableAudioInputs(true, (defaultAudioInputDeviceId) => {
          setAudioInputDeviceId(defaultAudioInputDeviceId);
        });
        setAvailableAudioInputs(filterUniqueAudioInputs(audioInputs));

        await KeenASR.prepare();

        const isASRBundleAvailable = await KeenASR.isASRBundleAvailable(bundleName);

        if (!isASRBundleAvailable) {
          setSDKSetupState(1);
          await KeenASR.fetchASRBundle(`../${bundleName}.tgz`);
        } 

        setSDKSetupState(2);
        await KeenASR.initialize(bundleName);
        
        if (!KeenASR.decodingGraphWithNameExists(decodingGraphName)) {
          setSDKSetupState(3);
          await KeenASR.createDecodingGraphFromPhrases(
            [text],
            [],
            KeenASR.SpeakingTask.SpeakingTaskOralReading,
            decodingGraphName
          );
        }

        if (!KeenASR.prepareForListeningWithCustomDecodingGraphWithName(decodingGraphName))
          throw new Error("SDK is not prepared for listening with custom decoding graph with name");

        KeenASR.setVADParameter(KeenASR.VADParameter.TimeoutForNoSpeechVADParameter, 10);
        KeenASR.setVADParameter(KeenASR.VADParameter.TimeoutEndSilenceForGoodMatchVADParameter, 5);
        KeenASR.setVADParameter(KeenASR.VADParameter.TimeoutEndSilenceForAnyMatchVADParameter, 5);
        KeenASR.setVADParameter(KeenASR.VADParameter.TimeoutMaxDurationVADParameter, 30);

        const handlePartialResult = (partialResult) => {
          const partialResultText = partialResult.text();

          if (shouldHighlightNextWordRef.current) {
            const alignmentResult = KeenASR.alignTexts(
              transformedRefText.split(" "),
              partialResultText.split(" "),
              false,
              insertToken
            );

            const highlightNextWordResult = highlightNextWord({
              alignedRef: alignmentResult.alignedRef,
              alignedHyp: alignmentResult.alignedHyp,
              refWords: text.split(" "),
              insertToken
            })

            textRef.current.replaceChildren(...highlightNextWordResult.childNodes);
          }

          setPartialResult(partialResultText)
        };

        const handleFinalResult = (finalResult) => {
          const finalResultText = finalResult.text();
          console.log("FINAL RESULT: ", finalResultText, finalResult);

          KeenASR.setVADParameter(KeenASR.VADParameter.TimeoutForNoSpeechVADParameter, 10);
          KeenASR.setVADParameter(KeenASR.VADParameter.TimeoutEndSilenceForGoodMatchVADParameter, 5);
          KeenASR.setVADParameter(KeenASR.VADParameter.TimeoutEndSilenceForAnyMatchVADParameter, 5);

          if (!finalResultText) {
            setIsListening(false); 
            textRef.current.replaceChildren(text);
            return;
          }

          const finalResultWords = finalResult.words();

          const alignmentResult = KeenASR.alignTexts(
            transformedRefText.split(" "),
            finalResultText.split(" "),
            false,
            insertToken
          );

          const alignmentStats = calculateAlignmentStats(alignmentResult.alignedRef, alignmentResult.alignedHyp);

          const totalWords = transformedRefText.split(" ").length;
          const wordsReadCorrectly = totalWords - (alignmentStats.insertions + alignmentStats.deletions + alignmentStats.substitutions);
          const wordsReadCorrectlyPct = (wordsReadCorrectly / totalWords * 100).toFixed(1);

          const firstWord = finalResultWords.get(0);
          const lastWord = finalResultWords.get(finalResultWords.size() - 1);
          const durationSec = lastWord.start_time + lastWord.duration - firstWord.start_time;
          const rateOfSpeech = (finalResultWords.size() / (durationSec / 60)).toFixed(0);

          const onWordClick = (e, word) => {
            audioRef.current.currentTime = word.start_time;
            audioRef.current.play();
            // setTimeout(() => {
            //   audioRef.current.pause();
            // }, word.duration * 1000)
          }

          const highlightAlignmentResult =
            highlightAlignment({
              alignedRef: alignmentResult.alignedRef,
              alignedHyp: alignmentResult.alignedHyp,
              refWords: text.split(" "),
              finalResultWords,
              onWordClick,
              insertToken
            });

          textRef.current.replaceChildren(...highlightAlignmentResult.childNodes);

          setAlignmentStats({
            reference: alignmentResult.alignedRef.join(" "),
            hypothesis: alignmentResult.alignedHyp.join(" "),
            ...alignmentStats
          });
          setDurationSec(durationSec);
          setFinalResult(finalResultText);

          setWordsReadCorrectlyPct(wordsReadCorrectlyPct);
          setRateOfSpeech(rateOfSpeech);

          setIsListening(false);
        };

        const handleAudioRecorder = (blob) => {
          setAudioURL(URL.createObjectURL(blob));
        };

        KeenASR.setResultHandlers(
          handlePartialResult,
          handleFinalResult,
          handleAudioRecorder
        );

        setIsStartBtnDisabled(false);
        setIsSDKLoading(false);
      } catch (err) {
        console.log(err);
        setErrorMessage(err?.message || "An error occurred.");
        setIsSDKLoading(false);
      }
    };

    const updateAvailableInputDevices = async () => {
      // its okay to again request permission for mic since we already have it and we want to sync new audioInputDeviceId with state
      const audioInputs = await KeenASR.getAvailableAudioInputs(true, (audioInputDeviceId) => {
        setAudioInputDeviceId(audioInputDeviceId);
      });
      setAvailableAudioInputs(filterUniqueAudioInputs(audioInputs));
    }

    navigator?.mediaDevices?.addEventListener?.('devicechange', updateAvailableInputDevices)

    setupSDK();

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', updateAvailableInputDevices)
    }
  }, []);

  useLayoutEffect(() => {
    textRef.current.textContent = text;
  }, [])

  useEffect(() => {
    return () => {
      if (audioURL) URL.revokeObjectURL(audioURL);
    }
  }, [audioURL]);
  
  useEffect(() => {
    if (errorMessage && countdownIntervalIdRef.current != null) {
      clearInterval(countdownIntervalIdRef.current);
      countdownIntervalIdRef.current = null;
      return;
    }

    countdownIntervalIdRef.current = setInterval(() => {
      setCountdownMin((countdown) => {
        if (countdown === 1) {
          clearInterval(countdownIntervalIdRef.current);
          return 0;
        }
        return countdown - 1;
      })
    }, 60000);
    
    return () => clearInterval(countdownIntervalIdRef.current);
  }, [errorMessage]);

  const startListening = async () => {
    try {
      await KeenASR.startListening(false);

      if (shouldHighlightNextWord) {
        const alignmentResult = KeenASR.alignTexts(transformedRefText.split(" "), [], false, insertToken);
        textRef.current.replaceChildren(highlightNextWord({
          alignedRef: alignmentResult.alignedRef,
          alignedHyp: alignmentResult.alignedHyp,
          refWords: text.split(" "),
          insertToken
        }))
      }
      else textRef.current.replaceChildren(text);

      setIsListening(true);
      setPartialResult("");
      setFinalResult("");
      setAlignmentStats(null);
      setDurationSec(null);
      setWordsReadCorrectlyPct(null);
      setRateOfSpeech(null);
      setAudioURL("");
    } catch(err) {
      console.log(err);
      setErrorMessage(err?.message || "An error occurred.");
    }
  };
  
  const stopListening = () => {
    KeenASR.setVADParameter(KeenASR.VADParameter.TimeoutForNoSpeechVADParameter, 0.2);
    KeenASR.setVADParameter(KeenASR.VADParameter.TimeoutEndSilenceForGoodMatchVADParameter, 0.2);
    KeenASR.setVADParameter(KeenASR.VADParameter.TimeoutEndSilenceForAnyMatchVADParameter, 0.2);
  }

  const changeAudioInputDevice = (e) => {
    KeenASR.setAudioInputDevice(e.target.value);
    setAudioInputDeviceId(e.target.value);
    console.log('selected audio input: ', e.target.value)
  }

  const handleHighlightNextWordChange = () => {
    const isChecked = !shouldHighlightNextWord;

    shouldHighlightNextWordRef.current = isChecked

    if (isListening && !isChecked) textRef.current.replaceChildren(text);
    else if (isListening && isChecked) {
      const alignmentResult = KeenASR.alignTexts(transformedRefText.split(" "), partialResult.split(" "), false, insertToken);
      textRef.current.replaceChildren(
        highlightNextWord({
          alignedRef: alignmentResult.alignedRef,
          alignedHyp: alignmentResult.alignedHyp,
          partialResultWords: partialResult ? partialResult.split(" ") : [],
          refWords: text.split(" ")
        })
      );
    }

    setShouldHighlightNextWord(isChecked);
  }
  
  return  <div className="demo">
      <div className="demo__container">
        {isSDKLoading && !errorMessage && 
        <div className="demo__loader">
          <Spinner progress={(SDKSetupState / SDKSetupStates.length) * 100} />
          <span className="demo__loader-status">${SDKSetupStates[SDKSetupState]}...</span>
        </div>}
        {!isSDKLoading &&
        <div className={"demo__trial-note "+countdownMin <= 1 ? "demo__trial-note--warning " : ""+countdownMin === 0 ? " demo__trial-note--err" : ""} >
          <AlertOutline className="demo__trial-note-icon" />
          <div className="demo__trial-note-msg">
            <span>{countdownMin === 0 ? 
            "Please reload the page if you would like to continue testing." :
            "This demo uses trial version of KeenASR SDK that works for 15 minutes at the time. At the end of the 15 minutes the page will let you know that the time has expired and you will have to reload the page if you'd like to continue."}
            </span>
            <span className="demo__trial-note-countdown">Countdown: <b>{countdownMin} min</b></span>
          </div>
        </div>}
        {errorMessage && <div className="demo__error">${errorMessage}</div>}
        <div className="demo__select-mic">
          <Microphone className="demo__select-mic-icon" />
          <select className="demo__select-mic-input" value={audioInputDeviceId} onChange={changeAudioInputDevice}>
            {availableAudioInputs.map(device => <option value={device.deviceId}>{device.label}</option>)}
          </select>
          <ChevronDown className="demo__select-mic-chevron" />
        </div>
        <div className="demo__title">
          <span className="demo__title-beta-label">BETA (v{KeenASR.version()})</span>
          <h1 className="demo__title-msg">ORAL READING</h1>
        </div>
        <p className="demo__text" ref={textRef} />
        <label className="demo__highlight-next-word">
          <input type="checkbox" checked={shouldHighlightNextWord} onClick={handleHighlightNextWordChange} />
          Highlight next word
        </label>
        {!isListening ? 
        <button className="demo__start-btn" disabled={isStartBtnDisabled} onClick={startListening}>
          <span className="demo__start-btn-front">START</span>
        </button>: 
        <button className="demo__start-btn" onClick={stopListening}>
          <span className="demo__start-btn-front">STOP</span>
        </button>}
        {wordsReadCorrectlyPct && rateOfSpeech && 
        <div className="demo__metrics">
          <div className="demo__words-read-correctly">
            <DoubleCheck />
            <span>Words Read Correctly: <b>${wordsReadCorrectlyPct}%</b></span>
          </div>
          <div className="demo__words-read-correctly">
            <Speedometer />
            <span>Rate of speech: <b>{rateOfSpeech} words/min</b></span>
          </div>
        </div>}
        {audioURL && <audio controls ref={audioRef} src={audioURL} className="demo__audio" />}
        <div className={"demo__debug "+isDebugInfoShown ? "demo__debug--active" : ""}>
          <button className="demo__debug-btn" onClick={() => setIsDebugInfoShown(!isDebugInfoShown)}>
            Show Debug Info
            <ChevronDown className="demo__debug-chevron" />
          </button>
          {isDebugInfoShown && 
          <pre className="demo__debug-info">
            {partialResult ? 
            <span>Partial result: <br />{partialResult}</span>
             : 
            <span>Start reading to get debug info</span>}
            {finalResult &&<>
              <span>Final result: <br />{finalResult}</span>
              <br />
            </>
            }
           {durationSec &&
            <span>Duration: {durationSec.toFixed(1)} sec (leading/trailing silence excluded)</span>}
            {alignmentStats &&<>
              <span>Insertions: {alignmentStats.insertions}</span>
              <span>Deletions: {alignmentStats.deletions}</span>
              <span>Substitutions: {alignmentStats.substitutions}</span>
              <span>Total words: {text.split(" ").length}</span>
              <br />
              <span>Reference text: <br />{alignmentStats.reference}</span>
              <span>Hypothesis text: <br />{alignmentStats.hypothesis}</span>
            </>
            }</pre>}
        </div>
    </div>
  </div>
  
};

const Spinner = ({progress}) => {
  return  <div className="spinner">
    <svg className="spinner__svg" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="spinner__ring" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path className="spinner__spin" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    {typeof progress === "number" && <span className="spinner__progress">${progress}%</span>}
  </div>
  
}
export default App
// render(html`<${App} />`, document.getElementById("root"));
