// ==UserScript==
// @name         parrot (color multichat for robin!)
// @namespace    http://tampermonkey.net/
// @version      3.64
// @description  Recreate Slack on top of an 8 day Reddit project.
// @author       dashed, voltaek, daegalus, vvvv, orangeredstilton, lost_penguin, AviN456, Annon201, LTAcosta, mofosyne
// @include      https://www.reddit.com/robin*
// @updateURL    https://github.com/5a1t/parrot/raw/master/robin.user.js
// @require       http://ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js
// @require      https://raw.githubusercontent.com/ricmoo/aes-js/master/index.js
// @grant   GM_getValue
// @grant   GM_setValue
// @grant   GM_addStyle
// @grant   GM_xmlhttpRequest
// ==/UserScript==
(function() {
    // hacky solutions
    var CURRENT_CHANNEL = "";
    var GOTO_BOTTOM = true;
    var robinChatWindow = $('#robinChatWindow');

    String.prototype.lpad = function(padString, length) {
        var str = this;
        var prepend_str = "";
        for (var i = str.length; i < length; i++) {
            prepend_str = padString + prepend_str;
        }
        return prepend_str + str;
    };

    String.prototype.rpad = function(padString, length) {
        var str = this;
        var prepend_str = "";
        for (var i = str.length; i < length; i++) {
            prepend_str = padString + prepend_str;
        }
        return str + prepend_str;
    };

    function tryHide(){
        if(settings.hideVote){
            console.log("hiding vote buttons.");
            $('.robin-chat--buttons').hide();
        }
        else{
            $('.robin-chat--buttons').show();
        }
    }

    // Channel selected in channel drop-down
    function dropdownChannel()
    {
        return $("#chat-prepend-select").val().trim();
    }

    function buildDropdown()
    {
        split_channels = getChannelString().split(",");
        drop_html = "";
        for (var tag in split_channels) {
            var channel_name = split_channels[tag].trim();
            drop_html += '<option value="' + channel_name + '">' + channel_name + '</option>';
        }

        $("#chat-prepend-select").html(drop_html);
        $("#chat-prepend-select").on("change", function() { updateTextCounter(); });
    }

    function updateUserPanel(){
        var options = {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        };

        $(".robin-room-participant").each( function(){
            lastseen = userExtra[$(this).find(".robin--username").text().trim()];
            if(lastseen){
                datestring = lastseen.toLocaleTimeString("en-us", options);
                $( this ).find(".robin--username").nextAll().remove();
                $( this ).find(".robin--username").after("<span class=\"robin-message--message\"style=\"font-size: 10px;\"> &nbsp;" + datestring + "</span>");
            }
        });
    }

    // Utils
    function getChannelString() {
        return settings.filterChannel ? settings.channel : "," + settings.channel;
    }

    function getChannelList()
    {
        var channels = String(getChannelString()).split(",");
        var channelArray = [];

        for (i = 0; i < channels.length; i++)
        {
            var channel = channels[i].trim();
            if (channel.length > 0)
                channelArray.push(channel.toLowerCase());
        }

        return channelArray;
    }

    function hasChannel(source)
    {
        channel_array = getChannelList();
        source = String(source).toLowerCase();

        return hasChannelFromList(source, channel_array, false);
    }

    function hasChannelFromList(source, channels, shall_trim, ignore_empty)
    {
        channel_array = channels;
        source = shall_trim ? String(source).toLowerCase().trim() : String(source).toLowerCase();

        for (idx = 0; idx < channel_array.length; idx++)
        {
            var current_chan = shall_trim ? channel_array[idx].trim() : channel_array[idx];

            if(ignore_empty && current_chan.length <= 0) {
                continue;
            }

            if(source.startsWith(current_chan.toLowerCase())) {
                return {
                    name: current_chan,
                    has: true,
                    index: idx
                };
            }
        }

        return {
            name: "",
            has: false,
            index: 0
        };
    }

    function formatNumber(n) {
        var part = n.toString().split(".");
        part[0] = part[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        return part.join(".");
    }

    function addMins(date, mins) {
        var newDateObj = new Date(date.getTime() + mins * 60000);
        return newDateObj;
    }

    function howLongLeft(endTime) {
        if (endTime === null) {
            return 0;
        }
        try {
            return Math.floor((endTime - new Date()) / 60 / 1000 * 10) / 10;
        } catch (e) {
            return 0;
        }
    }

    var UserExtra = {
        load: function loadSetting() {
            var userExtra = localStorage.getItem('parrot-user-extra');
            var users_version = localStorage.getItem('parrot-user-version');

            try {
                userExtra = userExtra ? JSON.parse(userExtra) : {};
            } catch(e) { console.log("Error parsing userExtra..");}

            userExtra = userExtra || {};

            if(users_version == 12){
                console.log("found a good user list!");
                        //return userExtra;
                //JSON.stringify is returning undefined.. Reset list each time for now. Will fix.
                return {};
            }
            else {
                console.log("found a bad user list, resetting!");
                        localStorage.setItem('parrot-user-extra', JSON.stringify({}));
                return {};
            }
        },

        save: function saveSetting(userExtra) {
            console.log("Saving");
            //console.log(JSON.stringify(userExtra));
            localStorage.setItem('parrot-user-extra', JSON.stringify(userExtra));
            localStorage.setItem('parrot-user-version', 12);
        }
    }

    var Settings = {
        setupUI: function() {
            // Open Settings button
            $robinVoteWidget.prepend("<div class='addon'><div id='chatstats' class='robin-chat--vote info-box-only'></div></div>");
            $robinVoteWidget.prepend("<div class='addon'><div class='usercount robin-chat--vote info-box-only'></div></div>");
            $robinVoteWidget.prepend("<div class='addon'><div class='timeleft robin-chat--vote info-box-only'></div></div>");
            $robinVoteWidget.prepend('<div class="addon" id="openBtn_wrap"><div class="robin-chat--vote" id="openBtn">Open Settings</div></div>');
            $robinVoteWidget.append('<div class="addon"><div class="robin-chat--vote" id="standingsBtn">Show Standings</div></div>');
            $robinVoteWidget.append('<div class="addon"><div class="robin-chat--vote" id="channelsBtn">Show Most Active Channels</div></div>');
            $("#openBtn_wrap").prepend('<div class="robin-chat--sidebar-widget">' +
                '<a target="_blank" href="https://www.reddit.com/r/parrot_script/"><div class="robin-chat--vote">' +
                '<img src="https://i.imgur.com/ch75qF2.png">Parrot</div><p>soKukunelits fork ~ ' + versionString + '</p></a></div>');

            // Setting container
            $(".robin-chat--sidebar").before(
                '<div class="robin-chat--sidebar" style="display:none;" id="settingContainer">' +
                    '<div class="robin-chat--sidebar-widget robin-chat--vote-widget" id="settingContent">' +
                         '<div class="robin-chat--vote" id="closeBtn">Close Settings</div>' +
                    '</div>' +
                '</div>'
            );

            // Standing container
            $("#settingContainer").before(
                '<div class="robin-chat--sidebar" style="display:none;" id="standingsContainer">' +
                    '<div class="robin-chat--sidebar-widget robin-chat--vote-widget" id="standingsContent">' +
                        '<div id="standingsTable">' +
                            '<div>Reddit leaderboard</div><br/>' +
                            '<div id="standingsTableReddit"></div><br/>' +
                            '<div id="standingsTableMonstrous"></div>' +
                        '</div>' +
                        '<a href="https://www.reddit.com/r/robintracking/comments/4czzo2/robin_chatter_leader_board_official/" target="_blank">' +
                        '<div class="robin-chat--vote">Full Leaderboard</div></a>' +
                        '<div class="robin-chat--vote" id="closeStandingsBtn">Close Standings</div>' +
                     '</div>' +
                 '</div>'
            );

            // Active channels container
            $("#settingContainer").before(
                '<div class="robin-chat--sidebar" style="display:none;" id="channelsContainer">' +
                    '<div class="robin-chat--sidebar-widget robin-chat--vote-widget" id="channelsContent">' +
                        '<div id="channelsTable">' +
                            '<div>Most Active Channels (experimental)</div><br/>' +
                            '<div id="activeChannelsTable"></div><br/>' +
                        '</div>' +
                        '<div class="robin-chat--vote" id="closeChannelsBtn">Close Channel List</div>' +
                     '</div>' +
                 '</div>'
            );

            $("#settingContent").append('<div class="robin-chat--sidebar-widget robin-chat--notification-widget"><ul><li>Click on chat name to hide sidebar</li><li>Left click usernames to mute.</li>' +
                '<li>Right click usernames to copy to message.<li>Tab autocompletes usernames in the message box.</li><li>Ctrl+shift+left/right switches between channel tabs.</li>' +
                '<li>Up/down in the message box cycles through sent message history.</li><li>Report any bugs or issues <a href="https://www.reddit.com/r/parrot_script/" target="_blank"><strong>HERE<strong></a></li>' +
                '<li>Created for soKukuneli chat (T16)</li></ul></div>');

            $("#robinDesktopNotifier").detach().appendTo("#settingContent");

            $("#openBtn").on("click", function openSettings() {
                $(".robin-chat--sidebar").hide();
                $("#settingContainer").show();
            });

            $("#closeBtn").on("click", function closeSettings() {
                $(".robin-chat--sidebar").show();
                $("#settingContainer").hide();
                $("#standingsContainer").hide();
                $("#channelsContainer").hide();
                tryHide();
                update();
            });

            $("#standingsBtn").on("click", function openStandings() {
                $(".robin-chat--sidebar").hide();
                startStandings();
                $("#standingsContainer").show();
            });

            $("#closeStandingsBtn").on("click", function closeStandings() {
                $(".robin-chat--sidebar").show();
                stopStandings();
                $("#standingsContainer").hide();
                $("#settingContainer").hide();
                $("#channelsContainer").hide();
            });

            $("#channelsBtn").on("click", function openChannels() {
                $(".robin-chat--sidebar").hide();
                startChannels();
                $("#channelsContainer").show();
            });

            $("#closeChannelsBtn").on("click", function closeChannels() {
                $(".robin-chat--sidebar").show();
                stopChannels();
                $("#channelsContainer").hide();
                $("#standingsContainer").hide();
                $("#settingContainer").hide();
            });

            $("#robinSendMessage").prepend('<div id="chat-prepend-area"><label>Send chat to</span><select id="chat-prepend-select"></select></div>');

            function setVote(vote) {
                return function() {
                    settings.vote = vote;
                    Settings.save(settings);
                };
            }

            $(".robin-chat--vote.robin--vote-class--abandon").on("click", setVote("abandon"));
            $(".robin-chat--vote.robin--vote-class--continue").on("click", setVote("stay"));
            $(".robin-chat--vote.robin--vote-class--increase").on("click", setVote("grow"));

            $('.robin-chat--buttons').prepend("<div class='robin-chat--vote robin--vote-class--novote'><span class='robin--icon'></span><div class='robin-chat--vote-label'></div></div>");
        },

        load: function loadSetting() {
            var setting = localStorage.getItem('robin-grow-settings');

            try {
                setting = setting ? JSON.parse(setting) : {};
            } catch(e) {}

            setting = setting || {};

            toggleSidebarPosition(setting);
            if (!setting.vote)
                setting.vote = "grow";

            return setting;
        },

        save: function saveSetting(settings) {
            localStorage.setItem('robin-grow-settings', JSON.stringify(settings));
        },

        addBool: function addBoolSetting(name, description, defaultSetting, callback) {
            defaultSetting = settings[name] || defaultSetting;

            $("#settingContent").append('<div class="robin-chat--sidebar-widget robin-chat--notification-widget"><label><input type="checkbox" name="setting-' + name + '"' + (defaultSetting ? ' checked' : '') + '>' + description + '</label></div>');
            $("input[name='setting-" + name + "']").change(function() {
                settings[name] = !settings[name];
                Settings.save(settings);

                if(callback) {
                    callback();
                }
            });
            if (settings[name] !== undefined) {
                $("input[name='setting-" + name + "']").prop("checked", settings[name]);
            } else {
                settings[name] = defaultSetting;
            }
        },

        addRadio: function addRadioSetting(name, description, items, defaultSettings, callback) {
            //items JSON format:
            //    {"id":[{"value":<string>,
            //            "friendlyName":<string>}]};

            defaultSettings = settings[name] || defaultSettings;

            $("#settingContent").append('<div id="settingsContainer-' + name + '" class="robin-chat--sidebar-widget robin-chat--notification-widget"><span style="font-weight: 300; letter-spacing: 0.5px; line-height: 15px; font-size:' + settings.fontsize + 'px;">' + description + '</span><br><br>');
            for (i in items.id) {
                $("#settingsContainer-" + name).append('<label><input type="radio" name="settingsContainer-' + name + '" value="' + items.id[i].value + '"> ' + items.id[i].friendlyName + '</input></label><br>');
            }
            $("#settingsContainer-" + name).append('</div>');

            if (settings[name] != undefined) {
                $("input:radio[name='setting-" + name + "'][value='" + settings[name] + "']").prop("checked", true);
            }
            else {
                $("input:radio[name='setting-" + name + "'][value='" + defaultSettings + "']").prop("checked", true);
            }

            $("input:radio[name='setting-" + name + "']").on("click", function () {
                settings[name] = $("input:radio[name='setting-" + name + "']:checked").val();
                Settings.save(settings);
            });

            if (callback) {
                callback();
            }
        },

        addInput: function addInputSetting(name, description, defaultSetting, callback) {
            defaultSetting = settings[name] || defaultSetting;

            $("#settingContent").append('<div id="robinDesktopNotifier" class="robin-chat--sidebar-widget robin-chat--notification-widget"><label>' + description + '</label><input type="text" name="setting-' + name + '"></div>');
            $("input[name='setting-" + name + "']").prop("defaultValue", defaultSetting)
                .on("change", function() {

                    settings[name] = String($(this).val());
                    Settings.save(settings);

                    if(callback) {
                        callback();
                    }
            });
            settings[name] = defaultSetting;
        },

        addButton: function(appendToID, newButtonID, description, callback, options) {
            options = options || {};
            $('#' + appendToID).append('<div class="addon"><div class="robin-chat--vote" style="font-weight: bold; padding: 5px;cursor: pointer;" id="' + newButtonID + '">' + description + '</div></div>');
            $('#' + newButtonID).on('click', function(e) { callback(e, options); });
        }
    };

    function clearChat() {
        console.log("chat cleared!");
        getChannelMessageList(selectedChannel).empty();
    }

    function setRobinMessageVisibility() {
        var prop = (settings.removeRobinMessages) ? "none" : "block";

        $('#robinMessageVisiblity')
            .text('.robin-message.robin--flair-class--no-flair.robin--user-class--system {display: ' + prop + ';}');
    }

    function toggleSidebarPosition(setting) {
        settings = settings || setting;
        var elements = {
            header: $('.robin-chat--header'),
            content: $('.content[role="main"]'),
            votePanel: $('.robin-chat--buttons'),
            sidebars: $('.robin-chat--sidebar'),
            chat: $('.robin-chat--main')
        };
        var sidebars = elements.sidebars.detach();

        settings.sidebarPosition ? elements.chat.before(sidebars) : elements.chat.after(sidebars);
    }

    function toggleTableMode(setting) {
        settings = settings || setting;
        if (settings.tableMode)
          $('.robin-chat--message-list').addClass('robin-chat--message-list-table-mode');
        else $('.robin-chat--message-list').removeClass('robin-chat--message-list-table-mode');
    }

    function grabStandings() {
        var standings;

        // Reddit leaderboard
        $.ajax({
            url: 'https://www.reddit.com/r/robintracking/comments/4czzo2/robin_chatter_leader_board_official/.rss?limit=1',
            data: {},
            success: function( data ) {
                var currentRoomName = $('.robin-chat--room-name').text();
                var standingsPost = $(data).find("entry > content").first();
                var decoded = $($('<div/>').html(standingsPost).text()).find('table').first();

                decoded.find('tr').each(function(i) {
                    var row = $(this).find('td,th');
                    var nameColumn = $(row.get(2));
                    nameColumn.find('a').prop('target','_blank');
                    if (currentRoomName.startsWith(nameColumn.text().substring(0,6))) {
                        var color = String(settings.leaderboard_current_color).length > 0 ? String(settings.leaderboard_current_color).trim() : '#22bb45';
                        row.css('background-color', color);
                    }
                    row.each(function(j) {if (j == 3 || j == 4 || j > 5) {
                        $(this).remove();
                    }});
                });

                $("#standingsTableReddit").html(decoded);
            },
            dataType: 'xml'
        });

        // monstrouspeace.com tracker board
        $("#standingsTableMonstrous").html("");

        if (settings.monstrousStats)
        {
            $.ajax({
                type: 'GET',
                url: 'https://monstrouspeace.com/robintracker/json.php',
                data: { get_param: 'value' },
                dataType: 'json',
                xhr: function() { return new GM_XHR(); },
                success: function(data) {
                    var decoded =
                        '<br/><div style="font-weight: bold; text-align: center;">MonstrousPeace.com tracking (experimental)</div><br/>' +
                        "<table>\r\n" +
                        "<thead>\r\n" +
                        "<tr><th>#</th><th>Participants</th><th>Grow</th><th>Stay</th><th>Room Name</th><th>Tier</th></tr>\r\n" +
                        "</thead>\r\n" +
                        "<tbody>\r\n";

                    $.each(data, function(index, e) {
                        decoded += "<tr><td>" + (index+1) + "</td><td>" + e.count + "</td><td>" + e.grow + "</td><td>" + e.stay + "</td><td>" + e.room + "</td><td>" + e.tier + "</td></tr>\r\n";
                    });
                    decoded +=
                        "</tbody>\r\n" +
                        "</table>\r\n" +
                        '<br/>';
                    $("#standingsTableMonstrous").html(decoded);
                }
            });
        }
    };

    //
    // XHR that can cross same origin policy boundaries
    //
    function GM_XHR() {
        this.type = null;
        this.url = null;
        this.async = null;
        this.username = null;
        this.password = null;
        this.status = null;
        this.headers = {};
        this.readyState = null;
        this.abort = function() { this.readyState = 0; };
        this.getAllResponseHeaders = function(name) { return this.readyState != 4 ? "" : this.responseHeaders; };
        this.getResponseHeader = function(name) {
            var regexp = new RegExp('^'+name+': (.*)$','im');
            var match = regexp.exec(this.responseHeaders);
            if (match) { return match[1]; }
            return '';
        };
        this.open = function(type, url, async, username, password) {
            this.type = type ? type : null;
            this.url = url ? url : null;
            this.async = async ? async : null;
            this.username = username ? username : null;
            this.password = password ? password : null;
            this.readyState = 1;
        };
        this.setRequestHeader = function(name, value) { this.headers[name] = value; };
        this.send = function(data) {
            this.data = data;
            var that = this;
            GM_xmlhttpRequest({
                method: this.type,
                url: this.url,
                headers: this.headers,
                data: this.data,
                onload: function(rsp) { for (var k in rsp) { that[k] = rsp[k]; } that.onreadystatechange(); },
                onerror: function(rsp) { for (var k in rsp) { that[k] = rsp[k]; } }
            });
        };
    };

    var standingsInterval = 0;
    function startStandings() {
        stopStandings();
        standingsInterval = setInterval(grabStandings, 120000);
        grabStandings();
    }

    function stopStandings() {
    if (standingsInterval){
            clearInterval(standingsInterval);
            standingsInterval = 0;
        }
    }

    function updateChannels()
    {
        // Sort the channels
        var channels = [];
        for(var channel in activeChannelsCounts){
            if (activeChannelsCounts[channel] > 1){
                channels.push(channel);
            }
        }

        channels.sort(function(a,b) {return activeChannelsCounts[a] - activeChannelsCounts[b];});

        // Build the table
        var html = "<table>\r\n" +
                   "<thead>\r\n" +
                   "<tr><th>#</th><th>Channel Name</th></tr>\r\n" +
                   "</thead>\r\n" +
                   "<tbody>\r\n";

        var limit = 50;
        if (channels.length < limit)
            limit = channels.length;

        for (var i = 0; i < limit; i++) {
            html += "<tr><td>" + (i+1) + "</td><td>" + channels[i] + "</td></tr>\r\n";
        }

        html += "</tbody>\r\n" +
                "</table>\r\n" +
                '<br/>';

        $("#activeChannelsTable").html(html);
    }

    var channelsInterval = 0;
    function startChannels() {
        stopChannels();
        channelsInterval = setInterval(updateChannels, 30000);
        updateChannels();
    }

    function stopChannels() {
    if (channelsInterval){
            clearInterval(channelsInterval);
            channelsInterval = 0;
        }
    }

    var currentUsersName = $('div#header span.user a').html();

    // Settings begin
    var $robinVoteWidget = $("#robinVoteWidget");

    // IF the widget isn't there, we're probably on a reddit error page.
    if (!$robinVoteWidget.length) {
        // Don't overload reddit, wait a bit before reloading.
        setTimeout(function() {
            window.location.reload();
        }, 300000);
        return;
    }

    // Get version string (if available from script engine)
    var versionString = "";
    if (typeof GM_info !== "undefined") {
        versionString = GM_info.script.version;
    }

    Settings.setupUI($robinVoteWidget);
    var settings = Settings.load();
    var userExtra = UserExtra.load();
    startUserExtra();

    function tryStoreUserExtra(){
        console.log("storing lastseens");
        UserExtra.save(userExtra);
    }

    var userExtraInterval = 0;

    function startUserExtra() {
        userExtraInterval = setInterval(listAllUsers, 10*1000);
        userExtraInterval = setInterval(tryStoreUserExtra, 20*1000);
    }
    // bootstrap
    tryHide();

    // Options begin
    Settings.addButton("settingContent", "update-script-button", "Update Parrot", function(){ window.open("https://github.com/5a1t/parrot/raw/master/robin.user.js?t=" + (+ new Date()), "_blank"); });
    Settings.addButton("robinChatInput", "clear-chat-button", "Clear Chat",  clearChat);
    Settings.addBool("hideVote", "Hide voting panel", false, tryHide);
    Settings.addBool("removeSpam", "Remove bot spam", true);
    Settings.addInput("spamFilters", "<label>Custom Spam Filters<ul><li><b>Checkbox 'Remove bot spam' (above)</b></li><li>Comma-delimited</li><li>Spaces are NOT stripped</li></ul></label>", "spam example 1,John Madden");
    Settings.addBool("enableUnicode", "Allow unicode characters. Unicode is considered spam and thus are filtered out", false);
    Settings.addBool("sidebarPosition", "Left sidebar", false, toggleSidebarPosition);
    Settings.addBool("force_scroll", "Force scroll to bottom", false);
    Settings.addInput("cipherkey", "16 Character Cipher Key", "Example128BitKey");
    Settings.addInput("maxprune", "Max messages before pruning", "500");
    
    Settings.addBool("tableMode", "Toggle table-mode for the message list", false, toggleTableMode);
    Settings.addInput("fontsize", "Chat font size", "12");
    Settings.addInput("fontstyle", "Font Style (default Consolas)", "");
    Settings.addBool("alignment", "Right align usernames", true);
    Settings.addInput("username_bg", "Custom background color on usernames", "");

    Settings.addBool("removeRobinMessages", "Hide [robin] messages everywhere", false, setRobinMessageVisibility);
    Settings.addBool("removeChanMessageFromGlobal", "Hide channel messages in Global", false);
    Settings.addBool("filterChannel", "Hide non-channel messages in Global", false, function() { buildDropdown(); });
    Settings.addInput("channel", "<label>Channel Listing<ul><li>Multi-room-listening with comma-separated rooms</li><li>Names are case-insensitive</li><li>Spaces are NOT stripped</li></ul></label>", "%parrot", function() { buildDropdown(); resetChannels(); });
    Settings.addInput("channel_exclude", "<label>Channel Exclusion Filter<ul><li>Multi-room-listening with comma-separated rooms</li><li><strong>List of channels to exclude from Global channel (e.g. trivia channels)</strong></li><li>Names are case-insensitive</li><li>Spaces are NOT stripped</li></ul></label>", "");

    Settings.addBool("tabChanColors", "Use color on channel tabs", true);
    Settings.addBool("twitchEmotes", "Twitch emotes (<a href='https://twitchemotes.com/filters/global' target='_blank'>Normal</a>, <a href='https://nightdev.com/betterttv/faces.php' target='_blank'>BTTV</a>)", false);
    Settings.addBool("youtubeVideo", "Inline youtube videos", false);
    Settings.addBool("timeoutEnabled", "Reload page after inactivity timeout", true);
    Settings.addInput("messageHistorySize", "Sent Message History Size", "50");
    Settings.addBool("monstrousStats", "Show automated leaderboard on standings page (asks for permission)</a>", false);
    Settings.addBool("reportStats", "Contribute statistics to the <a href='https://monstrouspeace.com/robintracker/'>Automated Leaderboard</a>.", true);
    Settings.addInput("statReportingInterval", "Report Statistics Interval (seconds) [above needs to be checked]", "300");
    Settings.addInput("leaderboard_current_color", "Highlight color of current chat room in leaderboard standings", '#22bb45');

    Settings.addBool("enableTabComplete", "Tab Autocomplete usernames", true);
    Settings.addBool("enableQuickTabNavigation", "Keyboard channel-tabs navigation", true);
    Settings.addBool("enableAdvancedNaviOptions", "Keyboard navigation key remapping. Use custom settings below for switching channels instead:", false, function(){
        $('input[name^=setting-quickTabNavi]').prop('disabled',!$('input[name=setting-enableAdvancedNaviOptions]').prop('checked'));
    });
    Settings.addBool("quickTabNaviCtrlRequired", "Ctrl", true);
    Settings.addBool("quickTabNaviShiftRequired", "Shift", false);
    Settings.addBool("quickTabNaviAltRequired", "Alt", true);
    Settings.addBool("quickTabNaviMetaRequired", "Meta", false);
    Settings.addInput("quickTabNaviKeyLeft", "Key codes: Left = 37, Up = 38, Right = 39, Down = 40. See <a href='https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/keyCode' target='_blank'>Mozilla.org's documentation</a> for more key codes.<br><br>Navigate left tab final key code","37");
    Settings.addInput("quickTabNaviKeyRight", "Navigate right tab final key code","39");
    $('input[name^=setting-quickTabNavi]').prop('disabled',!settings.enableAdvancedNaviOptions);

    $("#settingContent").append("<div class='robin-chat--sidebar-widget robin-chat--notification-widget'><label id='blockedUserContainer'>Muted Users (click to unmute)</label>");
    $("#blockedUserContainer").append("<div id='blockedUserList' class='robin-chat--sidebar-widget robin-chat--user-list-widget'></div>");

    $("#settingContent").append('<div class="robin-chat--sidebar-widget robin-chat--report" style="text-align:center;"><a target="_blank" href="https://www.reddit.com/r/parrot_script/">parrot&nbsp;v' + versionString + '</a></div>');

    $('head').append('<style id="robinMessageVisiblity"></style>');
    setRobinMessageVisibility();
    // Options end
    // Settings end

    var timeStarted = new Date();
    var name = $(".robin-chat--room-name").text();
    var urlRegex = new RegExp(/(?:(?:https?|ftp):\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,}))\.?)(?::\d{2,5})?(?:[/?#]\S*)?/ig);
    var youtubeRegex = new RegExp(/.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|watch\?(?:[a-zA-Z-_]+=[a-zA-Z0-9-_]+&)+v=)([^#\&\?]*).*/);

    var list = {};

    buildDropdown();

    var isEndingSoon = false;
    var endTime = null;
    var endTimeAttempts = 0;

    // Grab the timestamp from the time remaining message and then calc the ending time using the estimate it gives you
    function getEndTime() { // mostly from /u/Yantrio, modified by /u/voltaek
        endTimeAttempts++;
        var remainingMessageContainer = $(".robin--user-class--system:contains('approx')");
        if (remainingMessageContainer.length === 0) {
            // for cases where it says "soon" instead of a time on page load
            var endingSoonMessageContainer = $(".robin--user-class--system:contains('soon')");
            if (endingSoonMessageContainer.length !== 0) {
                isEndingSoon = true;
            }
            return null;
        }
        var message = $(".robin-message--message", remainingMessageContainer).text();
        var time = new Date($(".robin-message--timestamp", remainingMessageContainer).attr("datetime"));
        try {
            return addMins(time, message.match(/\d+/)[0]);
        } catch (e) {
            return null;
        }
    }

    endTime = getEndTime();

    var lastStatisticsUpdate = 0;
    function update() {
        switch(settings.vote) {
            case "abandon":
                $(".robin-chat--vote.robin--vote-class--abandon:not('.robin--active')").click();
                break;
            case "stay":
                $(".robin-chat--vote.robin--vote-class--continue:not('.robin--active')").click();
                break;
            case "grow":
                $(".robin-chat--vote.robin--vote-class--increase:not('.robin--active')").click();
                break;
            default:
                $(".robin-chat--vote.robin--vote-class--increase:not('.robin--active')").click();
                break;
        }
        if (endTime !== null || isEndingSoon) {
            $(".timeleft").text(isEndingSoon ? "waiting to merge" : formatNumber(howLongLeft(endTime)) + " minutes remaining");
        }
        else if (endTimeAttempts <= 3 && endTime === null) {
            $("#robinVoteWidget .timeleft").parent().hide();
            endTime = getEndTime();
            if (endTime !== null || isEndingSoon) {
                $("#robinVoteWidget .timeleft").parent().show();
            }
        }

        var users = 0;
        $.get("/robin/", function(a) {
            var START_TOKEN = "<script type=\"text/javascript\" id=\"config\">r.setup(";
            var END_TOKEN = ")</script>";
            var start = a.substring(a.indexOf(START_TOKEN)+START_TOKEN.length);
            var end = start.substring(0,start.indexOf(END_TOKEN));
            config = JSON.parse(end);
            list = config.robin_user_list;

            var counts = list.reduce(function(counts, voter) {
                counts[voter.vote] += 1;
                return counts;
            }, {
                INCREASE: 0,
                ABANDON: 0,
                NOVOTE: 0,
                CONTINUE: 0
            });

            var GROW_STR = formatNumber(counts.INCREASE);
            var ABANDON_STR = formatNumber(counts.ABANDON);
            var NOVOTE_STR = formatNumber(counts.NOVOTE);
            var STAY_STR = formatNumber(counts.CONTINUE);

            $robinVoteWidget.find('.robin--vote-class--increase .robin-chat--vote-label').html('grow<br>(' + GROW_STR + ')');
            $robinVoteWidget.find('.robin--vote-class--abandon .robin-chat--vote-label').html('abandon<br>(' + ABANDON_STR + ')');
            $robinVoteWidget.find('.robin--vote-class--novote .robin-chat--vote-label').html('no vote<br>(' + NOVOTE_STR + ')');
            $robinVoteWidget.find('.robin--vote-class--continue .robin-chat--vote-label').html('stay<br>(' + STAY_STR + ')');
            users = list.length;
            $(".usercount").text(formatNumber(users) + " users in chat");

            currentTime = Math.floor(Date.now()/1000);

            // if(settings.reportStats && (currentTime-lastStatisticsUpdate)>=parseInt(settings.statReportingInterval))

            // #yolo-robin till April 8th
            if((currentTime-lastStatisticsUpdate)>=parseInt(settings.statReportingInterval))
            {
                lastStatisticsUpdate = currentTime;

                // Report statistics to the automated leaderboard
                trackers = [
                    "https://monstrouspeace.com/robintracker/track.php"
                ];

                queryString = "?id=" + config.robin_room_name.substr(0,10) +
                    "&guid=" + config.robin_room_id +
                    "&ab=" + counts.ABANDON +
                    "&st=" + counts.CONTINUE +
                    "&gr=" + counts.INCREASE +
                    "&nv=" + counts.NOVOTE +
                    "&count=" + users +
                    "&ft=" + Math.floor(config.robin_room_date / 1000) +
                    "&rt=" + Math.floor(config.robin_room_reap_time / 1000);

                trackers.forEach(function(tracker){
                    $.get(tracker + queryString);
                });
            }

            var $chatstats = $("#chatstats");

            if(settings.hideVote){
                $chatstats.text("GROW: " + GROW_STR + " (" + (counts.INCREASE / users * 100).toFixed(0) + "%) STAY: " + STAY_STR + " (" + (counts.CONTINUE / users * 100).toFixed(0) + "%)");
                $chatstats.show();
            } else {
                $chatstats.hide();
            }
        });
        var lastChatString = $(".robin-message--timestamp").last().attr("datetime");
        var timeSinceLastChat = new Date() - (new Date(lastChatString));
        var now = new Date();
        if (timeSinceLastChat !== undefined && (timeSinceLastChat > 600000 && now - timeStarted > 600000)) {
            if (settings.timeoutEnabled)
                window.location.reload(); // reload if we haven't seen any activity in a minute.
        }

        // Try to join if not currently in a chat
        if ($("#joinRobinContainer").length) {
            $("#joinRobinContainer").click();
            setTimeout(function() {
                $("#joinRobin").click();
            }, 1000);
        }
    }

    // hash string so finding spam doesn't take up too much memory
    function hashString(str) {
        var hash = 0;

        if (str != 0) {
            for (i = 0; i < str.length; i++) {
                char = str.charCodeAt(i);
                if (str.charCodeAt(i) > 0x40) { // Let's try to not include the number in the hash in order to filter bots
                    hash = ((hash << 5) - hash) + char;
                    hash = hash & hash; // Convert to 32bit integer
                }
            }
        }

        return hash;
    }

    // Searches through all messages to find and hide spam
    var spamCounts = {};

    function findAndHideSpam() {

        // getChannelTab
        var len = channelList.length;

        while(len-- > -1) {

            //var $messages = getChannelTab(len).find(".robin-message");

            var $messages = getChannelMessageList(len).find(".robin-message");
            var maxprune = parseInt(settings.maxprune || "1000", 10);

            if (isNaN(maxprune)) {
                maxprune = 1000;
            }
            if ( maxprune <= 0) {
                maxprune = 1;
            }

            //console.log("maxprune:  " + maxprune + "  Messages.length: " + $messages.length + " len: " + len) ;

            if ($messages.length > maxprune) {
                $messages.slice(0, $messages.length - maxprune).remove();
            }
        }

        if (false && settings.findAndHideSpam) {
            // skips over ones that have been hidden during this run of the loop
            $('.robin--user-class--user .robin-message--message:not(.addon--hide)').each(function() {
                var $this = $(this);

                var hash = hashString($this.text());
                var user = $('.robin-message--from', $this.closest('.robin-message')).text();

                if (!(user in spamCounts)) {
                    spamCounts[user] = {};
                }

                if (hash in spamCounts[user]) {
                    spamCounts[user][hash].count++;
                    spamCounts[user][hash].elements.push(this);
                } else {
                    spamCounts[user][hash] = {
                        count: 1,
                        text: $this.text(),
                        elements: [this]
                    };
                }
                $this = null;
            });

            $.each(spamCounts, function(user, messages) {
                $.each(messages, function(hash, message) {
                    if (message.count >= 3) {
                        $.each(message.elements, function(index, element) {
                            $(element).closest('.robin-message').addClass('addon--hide').remove();
                        });
                    } else {
                        message.count = 0;
                    }

                    message.elements = [];
                });
            });
        }
    }

    // faster to save this in memory
    /* Detects unicode spam - Credit to travelton
     * https://gist.github.com/travelton */
    var UNICODE_SPAM_RE = /[\u0080-\uFFFF]/;
    function isBotSpam(text) {
        // starts with a [, has "Autovoter", or is a vote
        var filter = text.indexOf("[") === 0 ||
            text == "voted to STAY" ||
            text == "voted to GROW" ||
            text == "voted to ABANDON" ||
            text.indexOf("Autovoter") > -1 ||
            (!settings['enableUnicode'] && UNICODE_SPAM_RE.test(text));
        var spamFilters = settings.spamFilters.split(",").map(function(filter) { return filter.trim().toLowerCase(); });
        spamFilters.forEach(function(filterVal) {
            filter = filter || filterVal.length > 0 && text.toLowerCase().indexOf(filterVal) >= 0;
        });
        // if(filter)console.log("removing "+text);
        return filter;
    }

    // Individual mute button /u/verox-
    var mutedList = settings.mutedUsersList || [];
    $('body').on('click', ".robin--username", function() {
        var username = String($(this).text()).trim();
        var clickedUser = mutedList.indexOf(username);

        var $userNames = $(".robin--username:contains(" + username + ")");

        if (clickedUser == -1) {
            // Mute our user.
            mutedList.push(username);
            $userNames.css({textDecoration: "line-through"});
        } else {
            // Unmute our user.
            $userNames.css({textDecoration: "none"});
            mutedList.splice(clickedUser, 1);
        }

        settings.mutedUsersList = mutedList;
        Settings.save(settings);
        listMutedUsers();
    });

    // Copy cliked username into textarea /u/tW4r based on /u/verox-'s Individual mute button
    $('body').on('contextmenu', ".robin--username", function (event) {
        // Prevent context-menu from showing up
        event.preventDefault();
        // Get clicked username and previuos input source
        var username = String($(this).text()).trim();
        var source = String($("#robinMessageText").val());
        // Focus textarea and set the value of textarea
        $("#robinMessageText").focus().val("").val(source + " " + username + " ");
    });

    function listMutedUsers() {
        $("#blockedUserList").html("");

        $.each(mutedList, function(index, value){

            var mutedHere = "present";

            var userInArray = $.grep(list, function(e) {
                return e.name === value;
            });

            if (userInArray && userInArray.length > 0 && userInArray[0].present === true) {
                mutedHere = "present";
            } else {
                mutedHere = "away";
            }

            var votestyle = userInArray && userInArray.length > 0 ?
                " robin--vote-class--" + userInArray[0].vote.toLowerCase()
                : "";

            $("#blockedUserList").append(
                $("<div class='robin-room-participant robin--user-class--user robin--presence-class--" + mutedHere + votestyle + "'></div>")
                .append("<span class='robin--icon'></span><span class='robin--username' style='color:" + colorFromName(value) + "'>" + value + "</span>")
            );
        });
    }
    setTimeout(function() {
        listMutedUsers();
    }, 1500);

    function listAllUsers() {
        var actives = Object.keys(userExtra).map(function(key) {
            //console.log("key: " + key + " val: " + userExtra[key]);
            return [key, userExtra[key]];
        });

        // Sort the array based on the second element
        actives = actives.sort(function(first, second) {
            //console.log(first[1] + "   is <    " +  second[1]);
            //console.log(second[1] >= first[1]);
            return second[1] - first[1];
        });

        var options = {
            month: "2-digit",
             day: "2-digit", hour: "2-digit", minute: "2-digit"
        };

        $("#robinUserList").html("<h4>Total Actives: " + actives.length + "<h4>");

        $.each(actives, function(index,userpair){
            var mutedHere = "present";

            var userInArray = $.grep(list, function(e) {
                return e.name === userpair[0];
            });

            if (userInArray && userInArray.length > 0 && userInArray[0].present === true) {
                mutedHere = "present";
            } else {
                mutedHere = "away";
            }

            var votestyle = userInArray && userInArray.length > 0 ?
                " robin--vote-class--" + userInArray[0].vote.toLowerCase()
                : "";

            var datestring = userpair[1].toLocaleTimeString("en-us", options);

            name_area = $("<div class='robin-room-participant robin--user-class--user robin--presence-class--" + mutedHere + votestyle + "'></div>")
        .hover(function(){$('#user-submenu-' + userpair[0]).slideDown('medium');},function(){$('#user-submenu-' + userpair[0]).slideUp('medium');})
        .prepend('<ul class="parrot-user-submenu" id="user-submenu-' + userpair[0] + '" style="margin: 0px; padding: 0px; list-style: none; border: 1px solid rgb(171, 171, 171); display: none;" ><li><a target="_blank" href="https://www.reddit.com/message/compose/?to='+userpair[0]+'">Send '+ userpair[0] + ' a Message.</a></li> <li><a target="_blank" href="https://www.reddit.com/user/'+userpair[0]+'">View Comment History</a></li></ul>');
            $("#robinUserList").append(
        name_area
                .append("<span class='robin--icon'></span><span class='robin--username' style='color:" + colorFromName(userpair[0]) + "'>" + userpair[0] + "</span>" + "<span class=\"robin-message--message\"style=\"font-size: 10px;\"> &nbsp;" + datestring + "</span>")
            );
        });

        //updateUserPanel();
    }

    //colored text thanks to OrangeredStilton! https://gist.github.com/Two9A/3f33ee6f6daf6a14c1cc3f18f276dacd
    var colors = ['rgba(255,0,0,0.1)','rgba(0,255,0,0.1)','rgba(0,0,255,0.1)', 'rgba(0,255,255,0.1)','rgba(255,0,255,0.1)', 'rgba(255,255,0,0.1)'];

    //Emotes by ande_
    //Normal Twitch emotes
    var emotes = {};
    $.getJSON("https://twitchemotes.com/api_cache/v2/global.json", function(data) {
        emotes = data.emotes;
        for(var prop in emotes){
            emotes[prop.toLowerCase()] = emotes[prop];
        }
    });

    //BetterTwitchTV emotes
    var bttvEmotes = {};
    $.getJSON("https://api.betterttv.net/2/emotes", function(data) {
        data.emotes.forEach(function(emote){
            bttvEmotes[emote.code.toLowerCase()] = emote.id;
        });
    });

    // credit to wwwroth for idea (notification audio)
    // i think this method is better
    var notifAudio = new Audio("https://slack.global.ssl.fastly.net/dfc0/sounds/push/knock_brush.mp3");

    //
    // Tabbed channel windows by /u/lost_penguin
    //
    var channelList = [];
    var selectedChannel = -1;

    function setupMultiChannel()
    {
        // Add div to hold tabs
        $("#robinChatWindow").before("<div id=\"robinChannelDiv\" class=\"robin-chat--message-list\"><ul id=\"robinChannelList\"></ul></div>");

        // Add tab for all other messages
        $("#robinChannelList").append("<li id=\"robinChannelTab\"><a id=\"robinChannelLink\" href=\"#robinCh\">Global</a></li>");

        // Room tab events
        var tab = $("#robinChannelLink");
        tab.on("click", function() { selectChannel(""); });

        // Add rooms
        resetChannels();

        // Restore the selected channel in the url
        if (channelList[window.location.hash.charAt(8)]) selectChannel(window.location.hash);
    }

    function resetChannels()
    {
        channelList = getChannelList();

        var chatBox = $("#robinChatWindow");
        var tabBar = $("#robinChannelList");

        // Remove all existing rooms
        chatBox.children().each(function() { if (this.id.startsWith("robinChatMessageList-ch")) this.remove(); });
        tabBar.children().each(function() { if (this.id.startsWith("robinChannelTab-ch")) this.remove(); });

        // Create fresh rooms
        for (i = 0; i < channelList.length; i++)
        {
            // Room message window
            chatBox.append("<div id=\"robinChatMessageList-ch" + i + "\" class=\"robin-chat--message-list\">");

            // Room tab
            tabBar.append("<li id=\"robinChannelTab-ch" + i + "\"><a id=\"robinChannelLink-ch" + i + "\" href=\"#robinCh" + i + "\">" + channelList[i] + "</a></li>");

            // Room tab event
            var tab = $("#robinChannelLink-ch" + i);
            tab.on("click", function() { selectChannel($(this).attr("href")); });
        }

        toggleTableMode();
        selectChannel("");
    }

    function selectChannel(channelLinkId)
    {

        // Get channel index
        var channelIndex = -1;
        if ((typeof channelLinkId) == 'string' && channelLinkId.length > 8) {
            channelIndex = channelLinkId.substring(8);
        }
        if((typeof channelLinkId) == 'number') {
            channelIndex = channelLinkId;
        }


        $("#chat-prepend-select").val($("#robinChannelLink-ch" + (channelIndex >= 0 ? channelIndex : "") ).html());

        // Remember selection
        selectedChannel = channelIndex;

        // Show/hide channel drop-down
        if (channelIndex >= 0)
            $("#chat-prepend-area").css("display", "none");
        else
            $("#chat-prepend-area").css("display", "");

        // Update tab selection
        for (i = -1; i < channelList.length; i++)
            setChannelSelected(getChannelTab(i), getChannelMessageList(i), channelIndex == i);

        updateTextCounter();
    }

    function markChannelChanged(index)
    {
        if (index != selectedChannel)
            getChannelTab(index).attr("class", "robin-chan-tab-changed");
    }

    function setChannelSelected(tab, box, select)
    {

        if (select)
        {
            tab.attr("class", "robin-chan-tab-selected");
            box.css("display", "");

            doScroll();
        }
        else
        {
            if (tab.attr("class") == "robin-chan-tab-selected")
                tab.attr("class", "");

            box.css("display", "none");
        }
    }

    function getChannelTab(index)
    {
        if (index == -1) return $("#robinChannelLink");
        return $("#robinChannelLink-ch" + index);
    }

    function getChannelMessageList(index)
    {
        if (index == -1) return $("#robinChatMessageList");
        return $("#robinChatMessageList-ch" + index);
    }

    function convertTextToSpecial(messageText, elem)
    {
        urlRegex.lastIndex = 0;
        if (urlRegex.test(messageText)) {
            urlRegex.lastIndex = 0;
            var url = encodeURI(urlRegex.exec(messageText)[0]);
            var parsedUrl = url.replace(/^/, "<a target=\"_blank\" href=\"").replace(/$/, "\">"+url+"</a>");
            var oldHTML = $(elem).find('.robin-message--message').html();
            var newHTML = oldHTML.replace(url, parsedUrl);
            $(elem).find('.robin-message--message').html(newHTML);
        }
        if (settings.twitchEmotes){
            var split = messageText.split(' ');
            var changes = false;
            for (var i=0; i < split.length; i++) {
                var key = (split[i]).toLowerCase();
                if(emotes.hasOwnProperty(key)){
                    split[i] = "<img src=\"https://static-cdn.jtvnw.net/emoticons/v1/"+emotes[key].image_id+"/1.0\">";
                    changes = true;
                }
                if(bttvEmotes.hasOwnProperty(key)){
                    split[i] = "<img src=\"https://cdn.betterttv.net/emote/"+bttvEmotes[key]+"/1x\">";
                    changes = true;
                }
            }
            if (changes) {
                $(elem).find('.robin-message--message').html(split.join(' '));
            }
        }

        // TODO this can support vine videos too
        if (settings.youtubeVideo) {
            var matches = messageText.match(youtubeRegex);
            if (!matches || matches[1].length !== 11) return;

            var youtubeId = matches[1];
            var youtubeURL = "//www.youtube.com/embed/" + youtubeId + "?autoplay=1&autohide=1&enablejsapi=1";
            $videoContainer = $("<div class='video-container' style='width:400px;height:300px;background-color: #000;display:inline-block;position:relative;'><button class='press-play robin-chat--vote' style='margin:auto;position:absolute;top:0px;bottom:0px;left:0px;right:0px;width:100px;height:30px;'>Play Video</button><img style='width:400px;height:300px;' src='" + "//img.youtube.com/vi/" + youtubeId + "/hqdefault.jpg" + "' /></div>");

            $(elem).find('.robin-message--message').append($videoContainer);

            var iframe = "<iframe class='media-embed' type='text/html' width=400 height=300 src='"+ youtubeURL + "' frameBorder=0 allowFullScreen />";
            $videoContainer.find(".press-play").on("click", function() {
                $(this).off();
                $videoContainer.html(iframe);
            });
        }
    }

    function moveChannelMessage(channelIndex, message, overrideBGColor, isChanMessage)
    {
        var channel = getChannelMessageList(channelIndex);
        var messageCopy = message;

        if (isChanMessage && !settings.removeChanMessageFromGlobal)
            messageCopy = messageCopy.cloneNode(true);

        var messageElem = $(messageCopy.children && messageCopy.children[2]);
        var messageText = messageElem.text();

        // Remove channel name from channel messages
        if (messageText.startsWith(channelList[channelIndex]))
        {
            messageText = messageText.substring(channelList[channelIndex].length).trim();
            messageElem.text(messageText);
        }

        // Remove channel colour from channel messages
        if (!overrideBGColor) {
            if (!settings.tabChanColors) {
                messageElem.parent().css("background", "");
            }
        }

        convertTextToSpecial(messageText, messageCopy);

        channel.append(messageCopy);

        markChannelChanged(channelIndex);
    }

    function doScroll()
    {
        if (GOTO_BOTTOM || settings.force_scroll) {
            robinChatWindow.scrollTop(robinChatWindow[0].scrollHeight);
        }
    }

    //
    // Get selected destination channel for messages
    //
    function selChanName()
    {
        if (selectedChannel >= 0)
            return channelList[selectedChannel];
        return dropdownChannel();
    }

    function updateTextCounter()
    {
        var chanPrefix = selChanName();
        if (chanPrefix.length > 0)
            chanPrefix += " ";

        var maxLength = 140 - chanPrefix.length;

        var $robinMessageText = $("#robinMessageText");
        var message = $robinMessageText.val();
        var messageLength = message.length;

        // small channel names with a full message body switched to a long channel name
        // cause robinMessageText to overflow out of bounds
        // this truncates the message to the limit
        if (messageLength > maxLength) {
            message = message.substr(0, maxLength);
            $robinMessageText.val(message);
        }

        // subtract the channel prefix from the maxLength
        $("#robinMessageText").attr('maxLength', maxLength);
        $("#textCounterDisplayAlt").text(String(Math.max(maxLength - message.length), 0));
    }

    var pastMessageQueue = [];
    var pastMessageQueueIndex = 0;
    var pastMessageTemp = "";
    function updatePastMessageQueue(message)
    {
        pastMessageQueueIndex = 0;
        pastMessageTemp = "";
        var value = message;

        if (!value || (pastMessageQueue.length > 0 && value == pastMessageQueue[0]))
            return;

        pastMessageQueue.unshift(value);

        var maxhistorysize = parseInt(settings.messageHistorySize || "50", 10);
        if (maxhistorysize < 0 || isNaN(maxhistorysize)) {
            maxhistorysize = 50;
        }

        while (pastMessageQueue.length > maxhistorysize) {
            pastMessageQueue.pop();
        }
    }

    function onMessageBoxSubmit()
    {
        var chanName = selChanName();
        var message =  $("#robinMessageText").val();
        var dest = $("#robinMessageText");

        if(message.indexOf("@cipher") == 0 || message.indexOf("@c") == 0) {
            var encryption_cue = message.indexOf("@cipher") == 0 ? "@cipher" : "@c";
            var mes2 = "88z48" + $.trim(message.substr(encryption_cue.length));
            var key = aesjs.util.convertStringToBytes(String(settings['cipherkey']));
            var textBytes = aesjs.util.convertStringToBytes(mes2);
            var aesCtr = new aesjs.ModeOfOperation.ctr(key);
            var encryptedBytes = aesCtr.encrypt(textBytes);
            var result = "";

            for (index = 0; index <encryptedBytes.length; index++)
            {
                var c = encryptedBytes[index].toString(36);
                if (c.length == 1) c += "A";
                result += c;
            }
            dest.val(chanName + "em:" + result);
            updateTextCounter();
        }
        else {
            var chanPrefix = selChanName();

            if (chanPrefix.length > 0)
                chanPrefix += " ";

            if (message.startsWith("/me "))
                dest.val("/me " + chanPrefix + message.substring(4));
            else if (message.startsWith("/"))
                dest.val(message);
            else
                dest.val(chanPrefix + message);

            updateTextCounter();
        }

        updatePastMessageQueue(message);
        setTimeout(updateTextCounter, 50);
    }

    function onMessageBoxKeyUp(e)
    {
        var key = e.keyCode ? e.keyCode : e.charCode;
        key = key || e.which;

        if (key != 38 && key != 40)
            return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        var source = $("#robinMessageText").val();
        var chanName = selChanName();
        var namePart = "";

        // Up Arrow - Message History
        if (key == 38 && pastMessageQueue.length > pastMessageQueueIndex) {
            if (pastMessageQueueIndex === 0) {
                pastMessageTemp = source;
            }

            source = pastMessageQueue[pastMessageQueueIndex++];
        }
        // Down Arrow - Message History
        else if (key == 40 && pastMessageQueueIndex > 0) {
            pastMessageQueueIndex--;

            if (pastMessageQueueIndex === 0) {
                source = pastMessageTemp;
            } else {
                source = pastMessageQueue[pastMessageQueueIndex - 1];
            }
        }

        $("#robinMessageText").val(source);
        updateTextCounter();
    }

    // Monitor the most active channels.
    var activeChannelsQueue = [];
    var activeChannelsCounts = {};
    function updateMostActiveChannels(messageText)
    {
        var chanName = messageText;

        if (!chanName)
            return;

        // To simplify things, we're going to start by only handling channels that start with punctuation.
        if (!chanName.match(/^[!"#$%&\\'()\*+,\-\.\/:;<=>?@\[\]\^_`{|}~]/))
            return;

        var index = chanName.indexOf("<Crypto>");
        if (index >= 0)
            chanName = chanName.substring(0, index);

        index = chanName.indexOf(" ");
        if (index >= 0)
            chanName = chanName.substring(0, index);

        if (!chanName || chanName == messageText)
            return;

        chanName = chanName.toLowerCase();
        activeChannelsQueue.unshift(chanName);

        if (!activeChannelsCounts[chanName]) {
            activeChannelsCounts[chanName] = 0;
        }
        activeChannelsCounts[chanName]++;

        if (activeChannelsQueue.length > 2000){
            var oldChanName = activeChannelsQueue.pop();
            activeChannelsCounts[oldChanName]--;
        }
    }

    $('.robin-chat--header').click(function() {
        $(".robin-chat--sidebar").toggleClass("sidebarminimized");
    });

    var myObserver = new MutationObserver(mutationHandler);
    //--- Add a target node to the observer. Can only add one node at a time.
    // XXX Shou: we should only need to watch childList, more can slow it down.
    $("#robinChatMessageList").each(function() {
        myObserver.observe(this, { childList: true });
    });

    var counter=0.0;
    var countdown=0;
    function mutationHandler(mutationRecords) {
        mutationRecords.forEach(function(mutation) {
            var jq = $(mutation.addedNodes);
            // There are nodes added
            if (jq.length > 0) {
                var colors_match = {};
                split_channels = getChannelString().toLowerCase().split(",");

                for(i = 0; i < split_channels.length; i++){
                    colors_match[split_channels[i].trim()] = colors[i];
                }

                // cool we have a message.
                var $timestamp = $(jq[0]).find('.robin-message--timestamp');

                var $user = $(jq[0]).find('.robin--username');
                if(! $user.length) {
                    $timestamp.after('<span class="robin-message--from robin--username"></span>');
                    $user = $(jq[0]).find('.robin--username');
                }
                var thisUser = $user.text();
                var $message = $(jq[0]).find('.robin-message--message');
                var messageText = $message.text();

                // Decryption
                var chanName = hasChannel(messageText).name;
                if (messageText.indexOf(chanName + "em:") == 0) {
                    var plainMessage = "";
                    for (index = (chanName + "em:").length; index < messageText.length; index += 2)
                        plainMessage += ((plainMessage.length > 0 ? "," : "") + messageText.substring(index, index + 2).replace("A", ""));

                    var key = aesjs.util.convertStringToBytes(String(settings['cipherkey']));
                    var aesCtr = new aesjs.ModeOfOperation.ctr(key);
                    var hexList = plainMessage.split(",");
                    var textBytes = hexList.map(function (x) {
                        return parseInt(x, 36);
                    });
                    console.log("textbytes: " + textBytes.toString());
                    var decryptedBytes = aesCtr.decrypt(textBytes);
                    // Convert our bytes back into text
                    var decryptedText = aesjs.util.convertBytesToString(decryptedBytes);
                    messageText = messageText.replace(textBytes, decryptedText);

                    var special = "88z48";

                    if(decryptedText.indexOf(special) == -1){
                        $message = null;
                        $(jq[0]).remove();
                    }
                    else {
                        $(jq[0]).find('.robin-message--message').text(chanName+"<Crypto> "+decryptedText.substring(5));
                        messageText = $message.text();
                    }
                }
                
                var is_muted = (thisUser && mutedList.indexOf(thisUser) >= 0);
                var is_spam = (settings.removeSpam && isBotSpam(messageText));
                var remove_message = is_muted || is_spam;
                
                if (!remove_message) {
                    updateMostActiveChannels(messageText);
                }

                datenow = new Date();
                userExtra[$user.text()] = datenow;
                //updateUserPanel();

                var exclude_list = String(settings.channel_exclude).split(",");
                var results_chan_exclusion = hasChannelFromList(messageText, exclude_list, true, true);

                if (exclude_list.length > 0, String(settings.channel_exclude).trim().length > 0 && results_chan_exclusion.has) {
                    $message = null;
                    $(jq[0]).remove();
                    return;
                }

                if (String(settings['username_bg']).length > 0) {
                    $user.css("background",  String(settings['username_bg']));
                }
                if (settings['tableMode'] && settings['alignment']) {
                    $user.addClass('robin--username-align-right');
                }

                var alignedUser = settings['alignment'] ? $user.html().lpad('&nbsp;', 20) : $user.html().rpad('&nbsp;', 20);

                $user.html( (!settings['tableMode'] ? alignedUser : $user.html()) );
                var stylecalc = "";
                if (settings.fontstyle !== ""){
                    stylecalc = '"'+settings.fontstyle.trim()+'"' + ",";
                }
                stylecalc = stylecalc +  'Consolas, "Lucida Console", Monaco, monospace';
                $user.css("font-family", stylecalc).css("font-size", settings.fontsize+"px");
                $message.css("font-family", stylecalc).css("font-size", settings.fontsize+"px");
                
                var results_chan = hasChannel(messageText);

                var nextIsRepeat = jq.hasClass('robin--user-class--system') && messageText.indexOf("try again") >= 0;
                if (nextIsRepeat) {
                    var messageText = jq.next().find(".robin-message--message").text();
                    var chanName = selChanName();
                    if (messageText.toLowerCase().startsWith(chanName.toLowerCase()))
                        messageText = messageText.substring(chanName.length).trim();

                    $("#robinMessageText").val(messageText);
                    updateTextCounter();
                }

                remove_message = remove_message && !jq.hasClass("robin--user-class--system");
                if (remove_message) {
                    $message = null;
                    $(jq[0]).remove();

                    return;
                }

                var userIsMentioned = false;
                if (messageText.toLowerCase().indexOf(currentUsersName.toLowerCase()) !== -1) {
                    $message.parent().css("background","#FFA27F");
                    notifAudio.play();
                    userIsMentioned = true;
                } else {

                    //still show mentions in highlight color.

                    var result = hasChannel(messageText);

                    if(result.has) {
                        $message.parent().css("background", colors_match[result.name]);
                    } else {

                    var is_not_in_channels = (settings.filterChannel &&
                         !jq.hasClass('robin--user-class--system') &&
                         String(getChannelString()).length > 0 &&
                         !results_chan.has);

                        if (is_not_in_channels) {
                            $message = null;
                            $(jq[0]).remove();

                            return;
                        }
                    }
                }
                if (thisUser.indexOf("[robin]") !=-1){
                    if ($message.text().indexOf("RATELIMIT") != -1){
                       var rltime = $.trim($message.text().substr(54));
                       rltime = parseInt(rltime.substring(0, rltime.indexOf(' ')))+1;
                       if (rltime>10)rltime=1;
                        console.log(rltime.toString());
                       countdown=rltime;
                   }
                }

                // Move channel messages to channel tabs
                if (results_chan.has)
                    moveChannelMessage(results_chan.index, jq[0], userIsMentioned, true);

                if (selectedChannel >= 0 && thisUser.trim() == '[robin]')
                    moveChannelMessage(selectedChannel, jq[0], false, false);

                if (!results_chan.has || !settings.removeChanMessageFromGlobal)
                    markChannelChanged(-1);

                // If user is [robin], then we should only add the channel prefix if we're in
                // the Global channel.
                if (!settings.removeChanMessageFromGlobal && (thisUser.indexOf("[robin]") ==-1 || selectedChannel == -1))
                {
                    if (results_chan.has) {
                        messageText = messageText.substring(results_chan.name.length).trim();
                        $message.text(messageText);
                    }

                    // This needs to be done after any changes to the $message.text() since they will overwrite $message.html() changes
                    convertTextToSpecial(messageText, jq[0]);

                    $("<span class='robin-message--from'><strong>" + (!settings.tableMode ? results_chan.name.lpad("&nbsp", 6) : results_chan.name ) + "</strong></span>").css("font-family", '"Lucida Console", Monaco, monospace')
                        .css("font-size", "12px")
                        .insertAfter($timestamp);
                }

                findAndHideSpam();
                doScroll();
            }
        });
    }
    function countTimer() {
        counter += 0.5;
        if (countdown % 1 == 0 && countdown != 0) {
            $('#sendBtn').css('background-color', '#FF5555');
        } else {
            $('#sendBtn').css('background-color', '');
        }
        if (countdown > 1 ) {
            countdown -= 0.5;
            $('#sendBtn').html("Chat in: " + parseInt(countdown));
        } else if (countdown == 1) {
            $('#sendBtn').html("Send Message");
            countdown = 0;
        }

    }

    setInterval(update, 10000);
    update();

    setInterval(countTimer, 500);

    var flairColor = [
        '#e50000', // red
        '#db8e00', // orange
        '#ccc100', // yellow
        '#02be01', // green
        '#0083c7', // blue
        '#820080'  // purple
    ];

    function colorFromName(name) {
        sanitizedName = name.toLowerCase().replace(/[^a-z0-9]/g, "");
        flairNum = parseInt(sanitizedName, 36) % 6;
        return flairColor[flairNum];
    }

    // Initial pass to color names in user list
    $('#robinUserList').find('.robin--username').each(function(){
        this.style.color = colorFromName(this.textContent);
    });

    // When a user's status changes, they are removed from the user list and re-added with new status classes,
    // so here we watch for names being added to the user list to re-color
    var myUserListObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length > 0) {
                var usernameSpan = mutation.addedNodes[0].children[1];
                // This may need to be fixed. Until then, I'm adding this if statement to prevent errors flooding the console.
                if (usernameSpan) {
                    usernameSpan.style.color = colorFromName(usernameSpan.innerHTML);
                }
            }
        });
    });
    myUserListObserver.observe(document.getElementById("robinUserList"), { childList: true });

    // Color current user's name in chat and darken post backgrounds
    var currentUserColor = colorFromName(currentUsersName);
    $('<style>.robin--user-class--self .robin--username { color: ' + currentUserColor + ' !important; }</style>').appendTo('body');

    $(".text-counter-input").attr("id", "robinMessageText");
    $("#robinMessageText").on("input", function() { updateTextCounter(); });
    $("#robinMessageText").on("keyup", function(e) { onMessageBoxKeyUp(e); });

    $(".text-counter-display")
        .css("display", "none")
        .after('<span id="textCounterDisplayAlt">140</span>');

    // Send message button
    $("#robinSendMessage").append('<div id="sendBtn" class="robin-chat--vote">Send Message</div>'); // Send message

    // Submit message by pressing enter
    $("#robinSendMessage").on("submit", function() { onMessageBoxSubmit(); } );

    // Submit message by clicking button
    $("#robinSendMessage").append('<input id="sendBtnHidden" type="button" onclick=\'$(".text-counter-input").submit()\' style="display:none;"></input>');
    $("#sendBtn").on("click", function() { onMessageBoxSubmit(); $("#sendBtnHidden").trigger('click'); } );

    // Setup page for tabbed channels
    setupMultiChannel();

    $('#robinChatWindow').scroll(function() {
        if(robinChatWindow.scrollTop() < robinChatWindow[0].scrollHeight - robinChatWindow.height()) {
            GOTO_BOTTOM = false;
            return;
        }
        GOTO_BOTTOM = true;
    });

    $(document).keydown(function(e) {
        if (!settings.enableQuickTabNavigation) return; // Is quicknav enabled

        //console.log(e.keyCode);

        var lKeycode = 37;
        var rKeycode = 39; // set the keycodes to default

        if (settings.enableAdvancedNaviOptions) { // are we using advanced settings
            if (( settings.quickTabNaviCtrlRequired && !e.ctrlKey) ||
                (!settings.quickTabNaviCtrlRequired &&  e.ctrlKey))
                return;
            if (( settings.quickTabNaviAltRequired && !e.altKey) ||
                (!settings.quickTabNaviAltRequired &&  e.altKey))
                return;
            if (( settings.quickTabNaviShiftRequired && !e.shiftKey) ||
                (!settings.quickTabNaviShiftRequired &&  e.shiftKey))
                return;
            if (( settings.quickTabNaviMetaRequired && !e.metaKey) ||
                (!settings.quickTabNaviMetaRequired &&  e.metaKey))
                return;

            lKeycode = settings.quickTabNaviKeyLeft; // if we made it this far set the new keycodes
            rKeycode = settings.quickTabNaviKeyRight;
        }
        else { // using original keycodes
            if (!((e.metaKey || e.ctrlKey) && e.shiftKey)) {
                return;
            }
        }

        var key = e.keyCode ? e.keyCode : e.charCode
        key = key || e.which;
        if (key == lKeycode) {
            var newChanIdx = selectedChannel - 1;

            if (newChanIdx <= -2) {
                newChanIdx = channelList.length - 1;
            }
            selectChannel(newChanIdx);
        }

        if (key == rKeycode) {
            var newChanIdx = selectedChannel + 1;

            if (newChanIdx == channelList.length) {
                newChanIdx = -1;
            }
            selectChannel(newChanIdx);
        }
    });

    //merge easter egg
    (function(){
        var easterEgg_partyNoMore = localStorage.getItem('easterEgg_partyNoMore'),
            easterEgg_assetsCached = localStorage.getItem('easterEgg_assetsCached');

        //chance to pre-cache assets
        if(!easterEgg_assetsCached) {
            var shouldCache = Math.floor(Math.random() * (20 - 1 + 1)) + 1;
            if(shouldCache == 20) {
                localStorage.setItem('easterEgg_assetsCached', true);
                var easterEgg_cachedAirhorn = new Audio("https://www.myinstants.com/media/sounds/air-horn-club-sample_1.mp3");
                var easterEgg_cachedCheer = new Audio("https://www.myinstants.com/media/sounds/cheering.mp3");
                var easterEgg_cachedFireworks=new Image();
                easterEgg_cachedFireworks.src='https://media.giphy.com/media/araoLWtAIZKzS/giphy.gif';
                var easterEgg_cachedParrot=new Image();
                easterEgg_cachedParrot.src='https://media.giphy.com/media/10v0l8aVLyLJ5e/giphy.gif';
            }
        }

        //only play it once
        if(!easterEgg_partyNoMore){
            var easterEgg_robinTier,
                easterEgg_airHorn = [],
                easterEgg_airHorn_interval = [],
                easterEgg_airHorn_timeOut = [
                    300,
                    800,
                    1200,
                    500
                ],
                easterEgg_cheer,
                easterEgg_cheer_interval,
                easterEgg_cheer_timeOut = 600,
                easterEgg_scriptString = $('script#config')[0].innerHTML;//script object containing complete user list
                easterEgg_scriptString_startIndex = easterEgg_scriptString.indexOf('"robin_user_list": '),
                easterEgg_users_length = $.parseJSON('{'+easterEgg_scriptString.substr(easterEgg_scriptString_startIndex, easterEgg_scriptString.length).split(']')[0]+']}').robin_user_list.length,//script object parsed into user length
                easterEgg_fireWorks_URL = 'https://media.giphy.com/media/araoLWtAIZKzS/giphy.gif',
                easterEgg_fireWorks = [],
                easterEgg_fireWorks_BUFFER = 100,
                easterEgg_windowHeight = $( window ).height(),
                easterEgg_windowWidth = $( window ).width();

            if(easterEgg_users_length>4410){//the number to beat (or close to it)
                easterEgg_robinTier=17;
            }else{
                easterEgg_robinTier=16;
            }
            // uncomment to enable (requires clearing of local storage for multiple views)
            // easterEgg_robinTier=17;

            //if we're tier 17
            if(easterEgg_robinTier == 17){
                //set local storage so it doesn't happen again
                localStorage.setItem('easterEgg_partyNoMore', true);

                //create cheer loop
                easterEgg_cheer = new Audio("https://www.myinstants.com/media/sounds/cheering.mp3");
                easterEgg_cheer_interval = setInterval(function(){
                    easterEgg_cheer.play();
                }, easterEgg_cheer_timeOut);

                //create fireworks
                for (var i = 0; i < 7; i++) {
                    var easterEgg_fireWorks_image = $('<img>');
                    easterEgg_fireWorks_image.attr('src', easterEgg_fireWorks_URL);
                    easterEgg_fireWorks_image.css('position', 'absolute');
                    easterEgg_fireWorks_image.css('zIndex', '99');
                    easterEgg_fireWorks_image.css('top', Math.random() * ((easterEgg_windowHeight-easterEgg_fireWorks_BUFFER) - easterEgg_fireWorks_BUFFER));
                    easterEgg_fireWorks_image.css('left', Math.random() * ((easterEgg_windowWidth-easterEgg_fireWorks_BUFFER) - easterEgg_fireWorks_BUFFER));
                    easterEgg_fireWorks.push(easterEgg_fireWorks_image);

                    $('body').append(easterEgg_fireWorks_image);
                }

                //create airhorn loops
                for (var i = 0; i < 4; i++) {
                    (function(){
                        var y = i;
                        easterEgg_airHorn[y] = new Audio("https://www.myinstants.com/media/sounds/air-horn-club-sample_1.mp3");
                        easterEgg_airHorn_interval[y] = setInterval(function(){
                            (function(){
                                var x = y;
                                // easterEgg_airHorn[x].play();
                            })();
                        }, easterEgg_airHorn_timeOut[y]);
                    })();
                }
                //dancing parrot
                $('body').append('<div id="easterEgg_parrot" style="position:absolute; z-index:100; top:0; right:0; width:360px; height:203px"><img src="https://media.giphy.com/media/10v0l8aVLyLJ5e/giphy.gif"></div>');

                //"we did it" banner
                $('body').append('<div id="easterEgg_weDidItReddit" style="position:absolute; z-index:101; top:0; left:0; color:red; font-size: 100px;">WE DID IT REDDIT!!!111!</div>');

                //remove everything @30s
                setTimeout(function(){
                    $('#easterEgg_parrot').remove();
                    $('#easterEgg_weDidItReddit').remove();
                    clearTimeout(easterEgg_cheer_interval);
                    for (var i = 0; i < 4; i++) {
                        clearTimeout(easterEgg_airHorn_interval[i]);
                    }
                    for (var i = 0; i < easterEgg_fireWorks.length; i++) {
                        easterEgg_fireWorks[i].remove();
                    }
                }, 15000);
            }
        }
    })();

    // Add blank channel to initial system messages to avoid messing up the table view
    $('.robin--user-class--system time').after('<span class="robin-message--from"></span>');

    GM_addStyle(" \
        .robin--username { \
            cursor: pointer \
        } \
        #settingContent { \
            overflow-y: scroll; \
        } \
        #robinVoteWidget, \
        #closeBtn, \
        #sendBtn { \
            font-weight: bold; \
        } \
        .robin-chat--sidebar .robin-chat--vote, \
        #sendBtn { \
            margin-left: 0; \
        } \
        .info-box-only, \
        .robin--vote-class--novote { \
            pointer-events: none; \
        } \
        #openBtn, \
        #closeBtn, \
        #sendBtn, \
        #standingsBtn, \
        #channelsBtn { \
            cursor: pointer; \
        } \
        #openBtn_wrap { \
            text-align: center; \
        } \
        #openBtn_wrap > div:first-child { \
            padding-top: 0; \
        } \
        #openBtn_wrap p { \
            font-size: 12px; \
        } \
        #openBtn_wrap img { \
            display:inline-block; \
            vertical-align:middle; \
            width:15px; \
            height:15px; \
        } \
        #standingsContent .robin-chat--vote { \
            cursor: pointer; \
            font-weight: bold; \
            margin-left: 0; \
        } \
        #channelsContent .robin-chat--vote { \
            cursor: pointer; \
            font-weight: bold; \
            margin-left: 0; \
        } \
        .robin--user-class--self { \
            background: #F5F5F5; \
            font-weight: bold; \
        } \
        .robin--user-class--self .robin--username { \
            font-weight: bold; \
        } \
        #robinChatInput { \
            background: #EFEFED; \
        } \
        #chat-prepend-area { \
            font-size: 11px; \
            margin: 0 0 3px 20px; \
            display: inline-block; \
        } \
        #chat-prepend-area label { \
            margin-right: 0; \
            display: inline-block; \
        } \
        #chat-prepend-select { \
            margin: 0 10px; \
        } \
        #robinSendMessage .text-counter { \
            float: right; \
        } \
        #chatstats { \
            font-weight:bold; \
        } \
     \
        /* Change font to fixed-width */ \
        #robinChatWindow { \
            font-family: Consolas, 'Lucida Console', Monaco, monospace; \
        } \
     \
        /* Full Height Chat */ \
        @media(min-width:769px) { \
            .content { \
                border: none; \
            } \
            .footer-parent { \
                margin-top: 0; \
                font-size: inherit; \
            } \
            .debuginfo { \
                display: none; \
            } \
            .bottommenu { \
                padding: 0 3px; \
                display: inline-block; \
            } \
            #robinChatInput { \
                padding: 2px; \
            } \
            #sendBtn, #clear-chat-button { \
                margin-bottom: 0; \
            } \
            .robin-chat .robin-chat--body { \
                /* 130 is height of reddit header, chat header, and remaining footer */ \
                height: calc(100vh - 130px) \
            } \
        } \
     \
        /* Settings Panel */ \
        #settingContent .robin-chat--sidebar-widget { \
            padding: 6px 0; \
        } \
        #settingContent .robin-chat--sidebar-widget ul { \
            list-style-type: circle; \
            font-size: 12px; \
            padding-left: 40px; \
            font-weight: normal; \
        } \
        #settingContent .robin-chat--sidebar-widget label { \
            font-weight: bold; \
        } \
        #settingContent .robin-chat--sidebar-widget input[type='text'] { \
            width: 100%; \
            padding: 2px; \
        } \
        #settingContent .robin-chat--sidebar-widget input[type='checkbox'] { \
            vertical-align: middle; \
            margin-right: 0; \
        } \
     \
        /* RES Night Mode Support */ \
        .res-nightmode .robin-message, \
        .res-nightmode .robin--user-class--self .robin--username, \
        .res-nightmode .robin-room-participant .robin--username, \
        .res-nightmode:not([class*=flair]) > .robin--username, \
        .res-nightmode .robin-chat .robin-chat--vote, \
        .res-nightmode .robin-message[style*='color: white'] { \
            color: #DDD; \
        } \
        .res-nightmode .robin-chat .robin-chat--sidebar, \
        .res-nightmode .robin-chat .robin-chat--vote { \
            background-color: #262626; \
        } \
        .res-nightmode #robinChatInput { \
            background-color: #262626 !important; \
        } \
        .res-nightmode .robin-chat .robin-chat--vote { \
            box-shadow: 0px 0px 2px 1px #888; \
        } \
        .res-nightmode .robin-chat .robin-chat--vote.robin--active { \
            background-color: #444444; \
            box-shadow: 1px 1px 5px 1px black inset; \
        } \
        .res-nightmode .robin-chat .robin-chat--vote:focus { \
            background-color: #848484; \
            outline: 1px solid #9A9A9A; \
        } \
        .res-nightmode .robin--user-class--self { \
            background-color: #424242; \
        } \
        .res-nightmode .robin-message[style*='background: rgb(255, 162, 127)'] { \
            background-color: #520000 !important; \
        } \
        .res-nightmode .robin-chat .robin-chat--user-list-widget { \
            overflow-x: hidden; \
        } \
        .res-nightmode .robin-chat .robin-chat--sidebar-widget { \
            border-bottom: none; \
        } \
    \
        #standingsTable table {width: 100%} \
        #standingsTable table th { \
            font-weight: bold; \
        } \
        #standingsTable > div:first-child { \
            font-weight: bold; \
            text-align: center; \
        } \
        #channelsTable table {width: 100%} \
        #channelsTable table th { \
            font-weight: bold; \
        } \
        #channelsTable > div:first-child { \
            font-weight: bold; \
            text-align: center; \
        } \
        .robin-chat--sidebar.sidebarminimized { \
            display: none; \
        } \
    \
        /* Styles for tab bar */ \
        [id^='robinChannelLink'] { \
            width:10%; \
            display:inline-block; \
        } \
        #robinChannelList {         \
            width: 72%!important;   \
            top: 105px!important;   \
        }  \
        ul#robinChannelList { \
            list-style-type: none; \
            margin: 0px; \
            padding:0.3em 0; \
            position:absolute; \
            top:95px; \
            width:85%; \
        } \
        ul#robinChannelList li { \
            display: inline; \
        } \
        ul#robinChannelList li a { \
            width:auto!important; \
            color: #42454a; \
            background-color: #dedbde; \
            border: 1px solid #c9c3ba; \
            border-bottom: none; \
            padding:2px 30px!important; \
            text-decoration: none; \
            font-size:1em; \
        } \
        ul#robinChannelList li a:hover { \
            background-color: #f1f0ee; \
        } \
        ul#robinChannelList li a.robin-chan-tab-changed { \
            color: red; \
            font-weight: bold; \
        } \
        ul#robinChannelList li a.robin-chan-tab-selected { \
            color: blue; \
            background-color: white; \
            font-weight: bold; \
            padding: 0.7em 0.3em 0.38em 0.3em; \
        } \
        .robin-chat .robin-chat--message-list.robin-chat--message-list-table-mode { \
            display: table; \
        } \
        .robin-chat--message-list-table-mode .robin-message { \
            display: table-row !important; \
        } \
        .robin-chat--message-list-table-mode time, .robin-chat--message-list-table-mode .robin-message span { \
            display: table-cell !important; \
            padding: 0 5px; \
        } \
        .robin-chat--message-list-table-mode .robin-message time, .robin-chat--message-list-table-mode .robin-message .robin-message--from { \
            white-space: nowrap; \
            word-break: normal; \
            word-wrap: normal; \
        } \
        .robin-chat--message-list-table-mode .robin--username-align-right { \
            text-align: right; \
        } \
    ");
})();
