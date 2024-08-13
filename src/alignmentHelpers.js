export const calculateAlignmentStats = (alignedRef, alignedHyp, insertToken = "<eps>") => {
    let insertions = 0;
    let deletions = 0;
    let substitutions = 0;
  
    for (let i = 0; i < alignedRef.length; i++) {
      const alignedRefWord = alignedRef[i];
      const alignedHypWord = alignedHyp[i];
  
      if (alignedRefWord === alignedHypWord) continue;
  
      if (alignedHypWord === insertToken) deletions++;
      else if (alignedRefWord === insertToken) insertions++;
      else substitutions++;
    }
  
    return {
      insertions,
      deletions,
      substitutions,
    };
  }
  
  export const highlightAlignment = ({
    alignedRef,
    alignedHyp,
    refWords,
    finalResultWords,
    onWordClick,
    insertToken = "<eps>"
  }) => {
    let highlightAlignmentResult = document.createElement("div");
  
    let finalResultWordsIndex = 0;
    let insertions = 0;
  
    for (let i = 0; i < alignedRef.length; i++) {
      const alignedRefWord = alignedRef[i];
      const refWord = refWords[i - insertions];
      const alignedHypWord = alignedHyp[i];
  
      if (alignedRefWord === insertToken) {
        insertions++;
        finalResultWordsIndex++;
        continue;
      }
  
      const spanElement = document.createElement("span");
      spanElement.textContent = refWord;
  
      if (alignedRefWord === alignedHypWord) {
        spanElement.classList.add("correct-underline");
        const onWordClickClosure = (index) => (e) => onWordClick(e, finalResultWords.get(index));
        spanElement.addEventListener("click", onWordClickClosure(finalResultWordsIndex++));
      }
      else if (alignedHypWord === insertToken) spanElement.classList.add("deletion-underline");
      else {
        spanElement.classList.add("substitution-underline"); 
        finalResultWordsIndex++;
      }
  
      highlightAlignmentResult.append(spanElement, " ");
    }
  
    return highlightAlignmentResult;
  }
  
  export const highlightNextWord = ({
    alignedRef,
    alignedHyp,
    refWords,
    insertToken = "<eps>"
  }) => {
    let highlightNextWordResult = document.createElement("div");
  
    let lastCorrectWordIndex = null;
    let insertions = 0;
    let substitutions = 0;
  
    for (let i = 0; i < alignedRef.length; i++) {
      const alignedRefWord = alignedRef[i];
      const alignedHypWord = alignedHyp[i];
  
      if (alignedRefWord === alignedHypWord) {
        lastCorrectWordIndex = i; 
        substitutions = 0;
      }
      else if (alignedRefWord === insertToken) insertions++;
      else if (alignedHypWord !== insertToken && alignedRefWord !== alignedHypWord) substitutions++;
    }
  
    if (lastCorrectWordIndex) {
      lastCorrectWordIndex -= insertions;
      lastCorrectWordIndex += substitutions;
    }
  
    for (let i = 0; i < alignedRef.length; i++) {
      const refWord = refWords[i];
  
      const spanElement = document.createElement("span");
      spanElement.textContent = refWord;
  
      if (lastCorrectWordIndex === null && i === 0) spanElement.classList.add('correct-accent');
      else if (lastCorrectWordIndex != null && i === lastCorrectWordIndex + 1) spanElement.classList.add("correct-accent");
  
      highlightNextWordResult.append(spanElement, " ");
    }
  
    return highlightNextWordResult;
  }
  