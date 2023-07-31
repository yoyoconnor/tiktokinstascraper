with({
    copy
}) {
    var commentsDivXPath                 = '//div[contains(@class, "DivCommentListContainer")]';
    var allCommentsXPath                 = '//div[contains(@class, "DivCommentContentContainer")]';
    var level2CommentsXPath              = '//div[contains(@class, "DivReplyContainer")]';

    var publisherProfileUrlXPath         = '//span[contains(@class, "SpanUniqueId")]';
    var nicknameAndTimePublishedAgoXPath = '//span[contains(@class, "SpanOtherInfos")]';

    // we will filter these later because we have to handle them differently depending on what layout we have
    var likesCommentsSharesXPath         = "//strong[contains(@class, 'StrongText')]";

    var postUrlXPath                     = '//div[contains(@class, "CopyLinkText")]'
    var descriptionXPath                 = '//h4[contains(@class, "H4Link")]/preceding-sibling::div'

    // we need "View" or else this catches "Hide" too
    var viewMoreDivXPath                 = '//p[contains(@class, "PReplyAction") and contains(., "View")]';

    var confirmations = [
        'yes',
        'yep',
        'yeah',
        'yup',
        'done',
        'ok',
        'okay',
        'k',
        'kk',
        'completed',
        'confirm',
        'confirmed',
        'added',
        'added!',
        'finsihed',
        'alright',
        'done!',
        'done',
        'yes!'
    ]
    // more reliable than querySelector
    function getElementsByXPath(xpath, parent)
    {
        let results = [];
        let query = document.evaluate(xpath, parent || document,
            null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for (let i = 0, length = query.snapshotLength; i < length; ++i) {
            results.push(query.snapshotItem(i));
        }
        return results;
    }

    function getAllComments(){
        return getElementsByXPath(allCommentsXPath);
    }

    function quoteString(s) {
        return '"' + String(s).replaceAll('"', '""') + '"';
    }
    function removeAfterSpace(s){
        for(var i=0; i<s.length; i++){
            if(s[i]==' '){
                return s.substring(0,i);
            }
        }
        return s;
    }
    function isOneWord(s){
        for(var i=0; i<s.length; i++){
            if(s[i]==' '){
                return false;
            }
        }
        return true;
    }
    function isConfirmation(s){
        for(var i=0; i<confirmations.length; i++){
            if(s.includes(confirmations[i])){
                console.log('confirmation'+s);
                return true;
            }
        }
        return false;
    }


    // if there's an actual date, formats it as DD-MM-YYYY (though TikTok displays it as MM-DD)
    function extractNumericStats() {
        var strongTags = getElementsByXPath(likesCommentsSharesXPath);
        // the StrongText class is used on lots of things that aren't likes or comments; the last two or three are what we need
		// if it's a direct URL, shares are displayed, so we want the last three; if not, we only want the last two
        likesCommentsShares = parseInt(strongTags[(strongTags.length - 3)].outerText) ? strongTags.slice(-3) : strongTags.slice(-2);
        return likesCommentsShares;
    }

    function csvFromComment(comment) {
        commentText = getElementsByXPath('./div[1]/p', comment)[0].outerText;
        if(commentText.includes('insta:')){
            commentText= commentText.substring(6);
            while((commentText.substring(0,1)=='@')||(commentText.substring(0,1)==' ')){
            commentText= commentText.substring(1);}
        }
        else if(commentText.substring(0,1)=='@'){
            commentText= commentText.substring(1);
        }
        else if(isOneWord(commentText)&&(!isConfirmation(commentText))){
            commentText= commentText.substring(0);
        }
        else{return null;}
        return quoteString(removeAfterSpace(commentText));
    }

    // Loading 1st level comments
    var loadingCommentsBuffer = 30; // increase buffer if loading comments takes long and the loop breaks too soon
    var numOfcommentsBeforeScroll = getAllComments().length;
    while (loadingCommentsBuffer > 0) {

        allComments = getAllComments();
        lastComment = allComments[allComments.length - 1];
        lastComment.scrollIntoView(false);

        numOfcommentsAftScroll = getAllComments().length;

        // If number of comments doesn't change after 15 iterations, break the loop.
        if (numOfcommentsAftScroll !== numOfcommentsBeforeScroll) {
            loadingCommentsBuffer = 15;
        } else {
            // direct URLs can get jammed up because there's a recommended videos list that sometimes scrolls first, so scroll the div just in case
            commentsDiv = getElementsByXPath(commentsDivXPath)[0];
            commentsDiv.scrollIntoView(false);
            loadingCommentsBuffer--;
        };
        numOfcommentsBeforeScroll = numOfcommentsAftScroll;
        console.log('Loading 1st level comment number ' + numOfcommentsAftScroll);

        // Wait 0.3 seconds.
        await new Promise(r => setTimeout(r, 300));
    }
    console.log('Opened all 1st level comments');


    // Loading 2nd level comments
    loadingCommentsBuffer = 5; // increase buffer if loading comments takes long and the loop breaks too soon
    while (loadingCommentsBuffer > 0) {
        readMoreDivs = getElementsByXPath(viewMoreDivXPath);
        for (var i = 0; i < readMoreDivs.length; i++) {
            readMoreDivs[i].click();
        }

        await new Promise(r => setTimeout(r, 500));
        if (readMoreDivs.length === 0) {
            loadingCommentsBuffer--;
        } else {
            loadingCommentsBuffer = 5;
        }
        console.log('Buffer ' + loadingCommentsBuffer);
    }
    console.log('Opened all 2nd level comments');


    // Reading all comments, extracting and converting the data to csv
    var comments = getAllComments();
    var level2CommentsLength = getElementsByXPath(level2CommentsXPath).length;
    var publisherProfileUrl = getElementsByXPath(publisherProfileUrlXPath)[0].outerText;
    var nicknameAndTimePublishedAgo = getElementsByXPath(nicknameAndTimePublishedAgoXPath)[0].outerText.replaceAll('\n', ' ').split(' · ');

    // direct URLs don't include a place to copy the link (since it'd be redundant) so just grab the actual page URL
    var url = window.location.href.split('?')[0]
    var likesCommentsShares = extractNumericStats();
    var likes = likesCommentsShares[0].outerText;
    var totalComments = likesCommentsShares[1].outerText;

    // the pop-up search window interface doesn't include shares
    var shares = likesCommentsShares[2] ? likesCommentsShares[2].outerText : "N/A";
    var commentNumberDifference = Math.abs(parseInt(totalComments) - (comments.length));


    var csv =''
  
    var count = 1;
    var totalReplies = 0;
    var repliesSeen = 1; // Offset of replies from corresponding parent comment
    for (var i = 0; i < comments.length; i++) {
        tempcsv = csvFromComment(comments[i]);
        if (tempcsv != null){
            csv += tempcsv  + ',';
        }
        count++;
    }
    
    var apparentCommentNumber = parseInt(totalComments);
    console.log('Number of magically missing comments (not rendered in the comment section): ' + (apparentCommentNumber - count + 1) + ' (you have ' + (count - 1) + ' of ' + apparentCommentNumber + ')');
    console.log('CSV copied to clipboard!');

    copy(csv);
}