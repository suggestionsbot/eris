"use strict";

const Base = require("./Base");
const Endpoints = require("../rest/Endpoints");
const {SystemJoinMessages, MessageTypes} = require("../Constants");
const User = require("./User");

/**
* Represents a message
* @prop {Object?} activity The activity specified in the message
* @prop {Object?} application The application of the activity in the message
* @prop {Array<Object>} attachments Array of attachments
* @prop {User} author The message author
* @prop {PrivateChannel | TextChannel | NewsChannel} channel The channel the message is in
* @prop {Array<String>} channelMentions Array of mentions channels' ids
* @prop {String} content Message content
* @prop {Number} createdAt Timestamp of message creation
* @prop {Number?} editedTimestamp Timestamp of latest message edit
* @prop {Array<Object>} embeds Array of embeds
* @prop {Number} flags Message flags (see constants)
* @prop {String} [guildID] The ID of the guild this message is in (undefined if in DMs)
* @prop {String} id The ID of the message
* @prop {String} jumpLink The url used by Discord clients to jump to this message
* @prop {Member?} member The message author with server-specific data
* @prop {Boolean} mentionEveryone Whether the message mentions everyone/here or not
* @prop {Array<User>} mentions Array of mentioned users
* @prop {Object?} messageReference An object containing the reference to the original message if it is a crossposted message or reply
* @prop {String?} messageReference.messageID The id of the original message this message was crossposted from
* @prop {String} messageReference.channelID The id of the channel this message was crossposted from
* @prop {String?} messageReference.guildID The id of the guild this message was crossposted from
* @prop {Boolean} pinned Whether the message is pinned or not
* @prop {Object} reactions An object containing the reactions on the message. Each key is a reaction emoji and each value is an object with properties `me` (Boolean) and `count` (Number) for that specific reaction emoji.
* @prop {Message?} referencedMessage The message that was replied to. If undefined, message data was not received. If null, the message was deleted.
* @prop {Array<String>} roleMentions Array of mentioned roles' ids
* @prop {Number} timestamp Timestamp of message creation
* @prop {Boolean} tts Whether to play the message using TTS or not
* @prop {Number} type The type of the message
* @prop {String?} webhookID ID of the webhook that sent the message

*/
class Message extends Base {
    constructor(data, client) {
        super(data.id);
        this._client = client;
        this.type = data.type || 0;
        this.timestamp = Date.parse(data.timestamp);
        this.channel = client.getChannel(data.channel_id) || {
            id: data.channel_id
        };
        this.content = "";
        this.hit = !!data.hit;
        this.reactions = {};
        this.guildID = data.guild_id;
        this.webhookID = data.webhook_id;

        if(data.message_reference) {
            this.messageReference = {
                messageID: data.message_reference.message_id,
                channelID: data.message_reference.channel_id,
                guildID: data.message_reference.guild_id
            };
        } else {
            this.messageReference = null;
        }

        this.flags = data.flags || 0;

        if(data.author) {
            if(data.author.discriminator !== "0000") {
                this.author = client.users.update(data.author, client);
            } else {
                this.author = new User(data.author, client);
            }
        } else {
            this._client.emit("error", new Error("MESSAGE_CREATE but no message author:\n" + JSON.stringify(data, null, 2)));
        }
        if(data.referenced_message) {
            const channel = data.referenced_message.guild_id
                ? this._client.guilds.get(data.referenced_message.guild_id).channels.get(data.referenced_message.channel_id)
                : this._client.privateChannels.get(data.referenced_message.channel_id);
            if(channel) {
                this.referencedMessage = channel.messages.update(data.referenced_message, this._client);
            } else {
                this.referencedMessage = new Message(data.referenced_message, this._client);
            }
        } else {
            this.referencedMessage = data.referenced_message;
        }
        if(this.channel.guild) {
            if(data.member) {
                data.member.id = this.author.id;
                this.member = this.channel.guild.members.update(data.member, this.channel.guild);
            } else if(this.channel.guild.members.has(this.author.id)) {
                this.member = this.channel.guild.members.get(this.author.id);
            } else {
                this.member = null;
            }

            if(!this.guildID) {
                this.guildID = this.channel.guild.id;
            }
        } else {
            this.member = null;
        }

        switch(this.type) {
            case MessageTypes.DEFAULT: {
                break;
            }
            case MessageTypes.CHANNEL_NAME_CHANGE: {
                data.content = `${this.author.mention} changed the channel name: ${data.content}`;
                break;
            }
            case MessageTypes.CHANNEL_ICON_CHANGE: {
                data.content = `${this.author.mention} changed the channel icon.`;
                break;
            }
            case MessageTypes.CHANNEL_PINNED_MESSAGE: {
                data.content = `${this.author.mention} pinned a message to this channel. See all the pins.`;
                break;
            }
            case MessageTypes.GUILD_MEMBER_JOIN: {
                data.content = SystemJoinMessages[~~(this.createdAt % SystemJoinMessages.length)].replace(/%user%/g, this.author.mention);
                break;
            }
            case MessageTypes.USER_PREMIUM_GUILD_SUBSCRIPTION: {
                data.content = `${this.author.mention} just boosted the server!`;
                break;
            }
            case MessageTypes.USER_PREMIUM_GUILD_SUBSCRIPTION_TIER_1:
            case MessageTypes.USER_PREMIUM_GUILD_SUBSCRIPTION_TIER_2:
            case MessageTypes.USER_PREMIUM_GUILD_SUBSCRIPTION_TIER_3: {
                data.content = `${this.author.mention} just boosted the server! ${this.channel.guild ? this.channel.guild.name : data.guild_id} has achieved **Level ${this.type - 8}!**`;
                break;
            }
            case MessageTypes.CHANNEL_FOLLOW_ADD: {
                data.content = `${this.author.mention} has added ${data.content} to this channel`;
                break;
            }
            case MessageTypes.REPLY: {
                break;
            }
            default: {
                client.emit("warn", `Unhandled MESSAGE_CREATE type: ${JSON.stringify(data, null, 2)}`);
                break;
            }
        }

        this.update(data, client);
    }

    update(data, client) {
        if(this.type === 3) { // (╯°□°）╯︵ ┻━┻
            (this.channel.call || this.channel.lastCall).update(data.call);
        }
        if(data.content !== undefined) {
            this.content = data.content || "";
            this.mentionEveryone = !!data.mention_everyone;

            this.mentions = data.mentions.map((mention) => {
                const user = client.users.add(mention, client);
                if(mention.member && this.channel.guild) {
                    mention.member.id = mention.id;
                    this.channel.guild.members.update(mention.member, this.channel.guild);
                }
                return user;
            });

            this.roleMentions = data.mention_roles;
        }

        if(data.pinned !== undefined) {
            this.pinned = !!data.pinned;
        }
        if(data.edited_timestamp != undefined) {
            this.editedTimestamp = Date.parse(data.edited_timestamp);
        }
        if(data.tts !== undefined) {
            this.tts = data.tts;
        }
        if(data.attachments !== undefined) {
            this.attachments = data.attachments;
        }
        if(data.embeds !== undefined) {
            this.embeds = data.embeds;
        }
        if(data.activity !== undefined) {
            this.activity = data.activity;
        }
        if(data.application !== undefined) {
            this.application = data.application;
        }

        if(data.reactions) {
            data.reactions.forEach((reaction) => {
                this.reactions[reaction.emoji.id ? `${reaction.emoji.name}:${reaction.emoji.id}` : reaction.emoji.name] = {
                    count: reaction.count,
                    me: reaction.me
                };
            });
        }
    }

    get channelMentions() {
        if(this._channelMentions) {
            return this._channelMentions;
        }

        return (this._channelMentions = (this.content.match(/<#[0-9]+>/g) || []).map((mention) => mention.substring(2, mention.length - 1)));
    }

    get jumpLink() {
        return `${Endpoints.CLIENT_URL}${Endpoints.MESSAGE_LINK(this.channel.type === 1 ? "@me" : this.channel.guild.id, this.channel.id, this.id)}`;
    }

    /**
    * Add a reaction to a message
    * @arg {String} reaction The reaction (Unicode string if Unicode emoji, `emojiName:emojiID` if custom emoji)
    * @returns {Promise}
    */
    addReaction(reaction, userID) {
        return this._client.addMessageReaction.call(this._client, this.channel.id, this.id, reaction, userID);
    }

    /**
     * Crosspost (publish) a message to subscribed channels (NewsChannel only)
     * @returns {Promise<Message>}
     */
    crosspost() {
        return this._client.crosspostMessage.call(this._client, this.channel.id, this.id);
    }

    /**
    * Delete the message
    * @arg {String} [reason] The reason to be displayed in audit logs
    * @returns {Promise}
    */
    delete(reason) {
        return this._client.deleteMessage.call(this._client, this.channel.id, this.id, reason);
    }

    /**
    * Edit the message
    * @arg {String | Array | Object} content A string, array of strings, or object. If an object is passed:
    * @arg {String} content.content A content string
    * @arg {Boolean} [content.disableEveryone] Whether to filter @everyone/@here or not (overrides default)
    * @arg {Object} [content.embed] An embed object. See [the official Discord API documentation entry](https://discord.com/developers/docs/resources/channel#embed-object) for object structure
    * @arg {Number} [content.flags] A number representing the flags to apply to the message. See [the official Discord API documentation entry](https://discord.com/developers/docs/resources/channel#message-object-message-flags) for flags reference
    * @arg {Object} [content.allowedMentions] A list of mentions to allow (overrides default)
    * @arg {Boolean} [content.allowedMentions.everyone] Whether or not to allow @everyone/@here.
    * @arg {Boolean | Array<String>} [content.allowedMentions.roles] Whether or not to allow all role mentions, or an array of specific role mentions to allow.
    * @arg {Boolean | Array<String>} [content.allowedMentions.users] Whether or not to allow all user mentions, or an array of specific user mentions to allow.
    * @returns {Promise<Message>}
    */
    edit(content) {
        return this._client.editMessage.call(this._client, this.channel.id, this.id, content);
    }

    /**
    * Get a list of users who reacted with a specific reaction
    * @arg {String} reaction The reaction (Unicode string if Unicode emoji, `emojiName:emojiID` if custom emoji)
    * @arg {Number} [limit=100] The maximum number of users to get
    * @arg {String} [before] Get users before this user ID
    * @arg {String} [after] Get users after this user ID
    * @returns {Promise<Array<User>>}
    */
    getReaction(reaction, limit, before, after) {
        return this._client.getMessageReaction.call(this._client, this.channel.id, this.id, reaction, limit, before, after);
    }

    /**
    * Pin the message
    * @returns {Promise}
    */
    pin() {
        return this._client.pinMessage.call(this._client, this.channel.id, this.id);
    }

    /**
    * Remove a reaction from a message
    * @arg {String} reaction The reaction (Unicode string if Unicode emoji, `emojiName:emojiID` if custom emoji)
    * @arg {String} The ID of the user to remove the reaction for.
    * @returns {Promise}
    */
    removeReaction(reaction, userID) {
        return this._client.removeMessageReaction.call(this._client, this.channel.id, this.id, reaction, userID);
    }

    /**
    * Remove all reactions from a message for a single emoji
    * @arg {String} reaction The reaction (Unicode string if Unicode emoji, `emojiName:emojiID` if custom emoji)
    * @returns {Promise}
    */
    removeReactionEmoji(reaction) {
        return this._client.removeMessageReactionEmoji.call(this._client, this.channel.id, this.id, reaction);
    }

    /**
    * Remove all reactions from a message
    * @returns {Promise}
    */
    removeReactions() {
        return this._client.removeMessageReactions.call(this._client, this.channel.id, this.id);
    }

    /**
    * Unpin the message
    * @returns {Promise}
    */
    unpin() {
        return this._client.unpinMessage.call(this._client, this.channel.id, this.id);
    }

    toJSON(props = []) {
        return super.toJSON([
            "attachments",
            "author",
            "content",
            "editedTimestamp",
            "embeds",
            "hit",
            "mentionEveryone",
            "mentions",
            "pinned",
            "reactions",
            "roleMentions",
            "timestamp",
            "tts",
            "type",
            ...props
        ]);
    }
}

module.exports = Message;
