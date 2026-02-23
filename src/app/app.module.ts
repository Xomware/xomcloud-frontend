// app.module.ts
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

// Components
import { ToolbarComponent } from './components/toolbar/toolbar.component';
import { FooterComponent } from './components/footer/footer.component';
import { LoaderComponent } from './components/loader/loader.component';
import { ToastComponent } from './components/toast/toast.component';
import { CallbackComponent } from './components/callback/callback.component';

// Pages
import { HomeComponent } from './pages/home/home.component';
import { MyProfileComponent } from './pages/my-profile/my-profile.component';
import { UserProfileComponent } from './pages/user-profile/user-profile.component';
import { LikedTracksComponent } from './pages/liked-tracks/liked-tracks.component';
import { UserTracksComponent } from './pages/user-tracks/user-tracks.component';
import { PlaylistsComponent } from './pages/playlists/playlists.component';
import { PlaylistDetailComponent } from './pages/playlist-detail/playlist-detail.component';
import { UserPlaylistsComponent } from './pages/user-playlists/user-playlists.component';
import { FollowersComponent } from './pages/followers/followers.component';
import { FollowingComponent } from './pages/following/following.component';
import { SearchComponent } from './pages/search/search.component';
import { MyCrateComponent } from './pages/my-crate/my-crate.component';

// Services
import { AuthService } from './services/auth.service';
import { ToastService } from './services/toast.service';
import { UserService } from './services/user.service';
import { TrackService } from './services/track.service';
import { PlaylistService } from './services/playlist.service';
import { DownloadQueueService } from './services/download-queue.service';
import { DownloadService } from './services/download.service';

// Interceptors
import { AuthInterceptor } from './interceptors/auth.interceptor';

@NgModule({ declarations: [
        AppComponent,
        // Components
        ToolbarComponent,
        FooterComponent,
        LoaderComponent,
        ToastComponent,
        CallbackComponent,
        // Pages
        HomeComponent,
        MyProfileComponent,
        UserProfileComponent,
        LikedTracksComponent,
        UserTracksComponent,
        PlaylistsComponent,
        PlaylistDetailComponent,
        UserPlaylistsComponent,
        FollowersComponent,
        FollowingComponent,
        SearchComponent,
        MyCrateComponent,
    ],
    bootstrap: [AppComponent], imports: [BrowserModule,
        AppRoutingModule,
        BrowserAnimationsModule,
        FormsModule,
        ReactiveFormsModule], providers: [
        AuthService,
        ToastService,
        UserService,
        TrackService,
        PlaylistService,
        DownloadQueueService,
        DownloadService,
        {
            provide: HTTP_INTERCEPTORS,
            useClass: AuthInterceptor,
            multi: true,
        },
        provideHttpClient(withInterceptorsFromDi()),
    ] })
export class AppModule {}
