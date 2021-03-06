<template>
    <div class="player-bar-wrapper">
        <router-link to='/player'
            class="cover">
            <div class="img"
                :style="coverImgStyle"></div>
        </router-link>
        <div class="info">
            <div class="name">
                <span class="song">{{track.name}}</span>
                <span class="artist">{{track.artistName}}</span>
            </div>
            <div class="quick-actions">
                <mu-checkbox title="喜欢"
                    ref="chkFavorite"
                    uncheck-icon="favorite_border"
                    checked-icon="favorite"
                    color="red"
                    v-model="isFavorite"></mu-checkbox>
                <mu-checkbox title="收藏到歌单"
                    ref="chkShowPlaylists"
                    uncheck-icon="bookmark_border"
                    checked-icon="bookmark"
                    color="secondary"
                    v-model="collectPopupShown"></mu-checkbox>
                <mu-menu :open.sync="currentListShown"
                    placement="top"
                    popover-class="playerbar-current-list">
                    <mu-checkbox title="播放列表"
                        uncheck-icon="queue_music"
                        checked-icon="queue_music"
                        color="secondary"
                        v-model="currentListShown"></mu-checkbox>
                    <currentList slot="content"></currentList>
                </mu-menu>
            </div>
            <div class="progress">
                <mu-slider id="playerbar-progress"
                    :display-value="false"
                    class="slider"
                    :value="songProgress"
                    @change="handleProgressDrag"></mu-slider>
            </div>
            <span class="time">{{ timeCurrent | time }} / {{ timeTotal | time }}</span>
        </div>
        <div class="control">
            <mu-button fab
                small
                class="button"
                @click="playPreviousTrack">
                <mu-icon value="skip_previous"></mu-icon>
            </mu-button>
            <mu-button fab
                class="button"
                @click="handlePlayOrPause">
                <mu-icon :value="this.audioEl.paused ? 'play_arrow' : 'pause'"></mu-icon>
            </mu-button>
            <mu-button fab
                small
                class="button"
                @click="playNextTrack">
                <mu-icon value="skip_next"></mu-icon>
            </mu-button>
        </div>
    </div>
</template>

<script>
import { platform } from 'os';
import { mapActions, mapGetters, mapState } from 'vuex';

import ApiRenderer from '@/util/apiRenderer';
import currentList from './currentList.vue';
import {
    HIDE_COLLECT_POPUP,
    PAUSE_PLAYING_MUSIC,
    RESUME_PLAYING_MUSIC
} from '@/vuex/mutation-types';
import { sizeImg, HiDpiPx, bkgImg } from '@/util/image';
import { shortTime } from '@/util/formatter';

export default {
    data() {
        return {
            audioEl: {},
            hasRetried: false,
            timeTotal: 0,
            timeCurrent: 0,
            shouldFavorite: null,
            realCollectPopupShown: false,
            realCurrentListShown: false
        };
    },
    methods: {
        ...mapActions([
            'playAudio',
            'pauseAudio',
            'updateUiUrlNoCache',
            'playNextTrack',
            'playPreviousTrack',
            'updatePlaylistDetail',
            'toggleCollectPopup'
        ]),
        handlePlayOrPause() {
            this.ui.audioSrc && (this.audioEl.paused ? this.playAudio() : this.pauseAudio());
        },
        handleProgressDrag(value) {
            this.audioEl.currentTime = this.timeTotal * value / 100;
        },
        submitListened() {
            ApiRenderer.submitListened(this.playing.track.id, this.timeTotal);
        },
        async handleFavorite() {
            if (!this.loginValid || !this.playing.track) {
                this.$toast.message('真的这么喜欢我吗 o(*////▽////*)q');
                return;
            }
            const list = this.user.favoriteList;
            const track = this.playing.track;
            if (list.tracks.find(t => t.id === track.id)) {
                await ApiRenderer.uncollectTrack(list.id, track.id);
            } else {
                await ApiRenderer.collectTrack(list.id, track.id);
            }
            // it would take some time for NetEase to update playlist cover
            // img, so we just wait 200 ms
            setTimeout(async () => {
                await this.updatePlaylistDetail(list.id);
                this.shouldFavorite = null;
            }, 0);
        }
    },
    computed: {
        ...mapGetters(['playing', 'user', 'loginValid']),
        ...mapState(['playlist', 'ui']),
        track() {
            return this.playing.track || ({ name: 'Electron Netease Cloud Music' });
        },
        coverImgStyle() {
            if (this.playing.track && this.playing.track.album.picUrl) {
                return bkgImg(sizeImg(this.playing.track.album.picUrl, HiDpiPx(64)));
            }
        },
        songProgress() {
            return 100 * this.timeCurrent / this.timeTotal || 0;
        },
        isFavorite: {
            get() {
                if (!this.loginValid || !this.playing.track) {
                    return false;
                }
                if (this.shouldFavorite !== null) {
                    return this.shouldFavorite;
                }
                const { favoriteList } = this.user;
                if (favoriteList) {
                    const track = favoriteList.tracks.find(t => t.id === this.playing.track.id);
                    return typeof track === 'object';
                }
                return false;
            },
            set(val) {
                this.shouldFavorite = val === true;
                this.handleFavorite();
            }
        },
        collectPopupShown: {
            get() { return this.realCollectPopupShown; },
            set(val) {
                if (!this.loginValid && val === true && this.realCollectPopupShown === false) {
                    this.$toast.message('汝还没有登录呀      (눈‸눈)');
                    // set value of real `<input>` element to `false`.
                    // it depends on MuseUI impl
                    this.$refs.chkShowPlaylists.inputValue = false;
                    return;
                }
                if (!this.playing.track) {
                    this.$toast.message('究竟想收藏什么呢     (｡ŏ_ŏ)');
                    this.$refs.chkShowPlaylists.inputValue = false;
                    return;
                }
                this.realCollectPopupShown = val;
                if (val === true) {
                    this.toggleCollectPopup(this.playing.track.id);
                }
            }
        },
        currentListShown: {
            get() { return this.realCurrentListShown; },
            set(val) {
                if (val === true) {
                    setTimeout(() => {
                        document.getElementById(`cur-list-${this.playlist.index}`).scrollIntoViewIfNeeded();
                    }, 100);
                }
                this.realCurrentListShown = val;
            }
        }
    },
    filters: {
        time: shortTime
    },
    mounted() {
        /** @type {HTMLAudioElement} */
        const _audioEl = document.getElementById('playerbar-audio');
        let _playingIntervalId;
        this.audioEl = _audioEl;

        const _updateTime = () => this.timeCurrent = this.audioEl.currentTime;
        const _unsetInterval = () => _playingIntervalId = clearInterval(_playingIntervalId);

        _audioEl.addEventListener('loadedmetadata', () => {
            _unsetInterval();
            this.timeTotal = _audioEl.duration;
            this.timeCurrent = _audioEl.currentTime = 0;
            if (!this.ui.paused) _audioEl.play();
        });

        _audioEl.addEventListener('seeking', _updateTime);

        _audioEl.addEventListener('playing', () => {
            _updateTime();
            // update playing process time after the time reaches a 'integer' second
            // why use 1.1 not 1 ? maybe there is a little lag in event loop... I don't know
            const timeOut = (1.1 - _audioEl.currentTime % 1) * 1000;
            setTimeout(() => {
                _updateTime();
                // only set interval when it's not set, to avoid massive events
                if (!_playingIntervalId)
                    _playingIntervalId = setInterval(() => _updateTime(), 1000);
            }, timeOut);
        });

        _audioEl.addEventListener('pause', () => _updateTime() && _unsetInterval());

        _audioEl.addEventListener('ended', () => {
            this.submitListened();
            this.playNextTrack();
        });

        _audioEl.addEventListener('error', () => {
            if (!this.track.id) return;
            if (!this.hasRetried) {
                this.hasRetried = true;
                this.updateUiUrlNoCache();
                return;
            }
            this.hasRetried = false;
            this.$toast.message('这首歌听不了了，换下一首吧   (￣△￣;) ');
            setTimeout(() => this.playNextTrack(), 3000);
        });

        this.$store.subscribe(mutation => {
            switch (mutation.type) {
                case PAUSE_PLAYING_MUSIC:
                    _audioEl.pause();
                    break;
                case RESUME_PLAYING_MUSIC:
                    _audioEl.play();
                    break;
                case HIDE_COLLECT_POPUP:
                    this.collectPopupShown = false;
                    break;
            }
        });

        if (platform() === 'linux') {
            require('@/util/mpris').bindEventListener(_audioEl);
        }
    },
    components: {
        currentList
    }
};
</script>

<style lang="less">
.player-bar-wrapper {
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
    display: flex;
    user-select: none;
    cursor: default;
    font-size: 0;
    height: 64px;
    position: relative;
    .cover {
        .img {
            background-image: url('~assets/img/cover_default.webp');
            background-size: cover;
            width: 64px;
            height: 64px;
        }
    }
    .info {
        font-size: 14px;
        padding: 10px 10px 2px;
        flex-grow: 1;
        overflow: hidden;
        display: grid;
        grid-template-columns: 1fr 100px;
        grid-template-rows: 50% 50%;
        .name {
            display: flex;
            span {
                max-width: 310px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .artist {
                margin-left: 10px;
                color: dimgrey;
            }
        }
        .quick-actions {
            width: 100px;
            display: flex;
            justify-content: space-between;
        }
        .progress {
            .slider {
                margin: 0;
            }
        }
        .time {
            width: 100px;
            text-align: right;
        }
    }
    .control {
        width: 180px;
        padding: 4px;
        display: flex;
        justify-content: space-around;
        align-items: center;
        .button {
            box-shadow: white 0 0 0;
        }
    }
}

.playerbar-current-list {
    border-radius: 0; // avoid 'repaint on scroll'
    width: 420px;
    height: 360px;
    font-size: 14px;
    position: fixed;
    top: unset !important;
    left: unset !important;
    right: 8px !important;
    bottom: 72px !important;
}
</style>
